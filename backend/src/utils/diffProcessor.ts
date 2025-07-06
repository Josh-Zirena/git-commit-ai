export interface DiffChunk {
  filePath: string;
  changeType: 'added' | 'deleted' | 'modified' | 'renamed';
  content: string;
  linesAdded: number;
  linesDeleted: number;
  priority: number; // 1-5, higher = more important
}

export interface ProcessedDiff {
  chunks: DiffChunk[];
  summary: string;
  totalFiles: number;
  totalLinesAdded: number;
  totalLinesDeleted: number;
  isTruncated: boolean;
}

export class DiffProcessor {
  private readonly maxChunkSize: number;
  private readonly maxTotalSize: number;
  private readonly maxFiles: number;

  constructor(options: {
    maxChunkSize?: number;
    maxTotalSize?: number;
    maxFiles?: number;
  } = {}) {
    this.maxChunkSize = options.maxChunkSize || 50 * 1024; // 50KB per chunk
    this.maxTotalSize = options.maxTotalSize || 500 * 1024; // 500KB total
    this.maxFiles = options.maxFiles || 50;
  }

  processDiff(diff: string): ProcessedDiff {
    const chunks = this.splitIntoChunks(diff);
    const prioritizedChunks = this.prioritizeChunks(chunks);
    const selectedChunks = this.selectMostImportantChunks(prioritizedChunks);
    
    return {
      chunks: selectedChunks,
      summary: this.generateSummary(chunks),
      totalFiles: chunks.length,
      totalLinesAdded: chunks.reduce((sum, chunk) => sum + chunk.linesAdded, 0),
      totalLinesDeleted: chunks.reduce((sum, chunk) => sum + chunk.linesDeleted, 0),
      isTruncated: selectedChunks.length < chunks.length
    };
  }

  private splitIntoChunks(diff: string): DiffChunk[] {
    const chunks: DiffChunk[] = [];
    const files = diff.split(/(?=^diff --git)/m).filter(Boolean);

    for (const fileBlock of files) {
      const chunk = this.parseFileChunk(fileBlock);
      if (chunk) {
        chunks.push(chunk);
      }
      
      // Stop processing if we hit the file limit
      if (chunks.length >= this.maxFiles) {
        break;
      }
    }

    return chunks;
  }

  private parseFileChunk(fileBlock: string): DiffChunk | null {
    const lines = fileBlock.split('\n');
    
    // Extract file path
    const diffHeader = lines.find(line => line.startsWith('diff --git'));
    if (!diffHeader) return null;
    
    const pathMatch = diffHeader.match(/diff --git a\/(.+) b\/(.+)/);
    if (!pathMatch) return null;
    
    const filePath = pathMatch[2]; // Use the "after" path
    
    // Determine change type
    let changeType: DiffChunk['changeType'] = 'modified';
    if (fileBlock.includes('new file mode')) {
      changeType = 'added';
    } else if (fileBlock.includes('deleted file mode')) {
      changeType = 'deleted';
    } else if (fileBlock.includes('rename from')) {
      changeType = 'renamed';
    }
    
    // Count line changes
    let linesAdded = 0;
    let linesDeleted = 0;
    
    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        linesAdded++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        linesDeleted++;
      }
    }
    
    // Truncate content if too large
    let content = fileBlock;
    if (content.length > this.maxChunkSize) {
      const truncatePoint = this.findGoodTruncationPoint(content, this.maxChunkSize);
      content = content.substring(0, truncatePoint) + '\n... (truncated)';
    }
    
    const priority = this.calculatePriority(filePath, changeType, linesAdded, linesDeleted);
    
    return {
      filePath,
      changeType,
      content,
      linesAdded,
      linesDeleted,
      priority
    };
  }

  private calculatePriority(
    filePath: string, 
    changeType: DiffChunk['changeType'], 
    linesAdded: number, 
    linesDeleted: number
  ): number {
    let priority = 3; // Default priority
    
    // Boost priority for important file types
    if (filePath.includes('package.json') || filePath.includes('Cargo.toml')) {
      priority += 1;
    }
    
    if (filePath.includes('README') || filePath.includes('CHANGELOG')) {
      priority += 1;
    }
    
    if (filePath.includes('.config') || filePath.includes('Dockerfile')) {
      priority += 1;
    }
    
    // Boost priority for core source files
    if (filePath.match(/\.(ts|js|py|rs|go|java|cpp|c)$/)) {
      priority += 1;
    }
    
    // Lower priority for test files, docs, and generated files
    if (filePath.includes('test') || filePath.includes('spec') || 
        filePath.includes('__tests__') || filePath.includes('.test.')) {
      priority -= 1;
    }
    
    if (filePath.includes('node_modules') || filePath.includes('dist/') || 
        filePath.includes('build/') || filePath.includes('.min.')) {
      priority -= 2;
    }
    
    // Adjust based on change size
    const totalChanges = linesAdded + linesDeleted;
    if (totalChanges > 100) {
      priority += 1;
    } else if (totalChanges < 5) {
      priority -= 1;
    }
    
    // Boost new/deleted files
    if (changeType === 'added' || changeType === 'deleted') {
      priority += 1;
    }
    
    return Math.max(1, Math.min(5, priority));
  }

  private prioritizeChunks(chunks: DiffChunk[]): DiffChunk[] {
    return chunks.sort((a, b) => b.priority - a.priority);
  }

  private selectMostImportantChunks(chunks: DiffChunk[]): DiffChunk[] {
    const selected: DiffChunk[] = [];
    let currentSize = 0;
    
    for (const chunk of chunks) {
      if (currentSize + chunk.content.length <= this.maxTotalSize) {
        selected.push(chunk);
        currentSize += chunk.content.length;
      } else {
        // Try to fit a truncated version
        const remainingSpace = this.maxTotalSize - currentSize;
        if (remainingSpace > 1000) { // Only if we have reasonable space left
          const truncatedContent = chunk.content.substring(0, remainingSpace - 100) + '\n... (truncated)';
          selected.push({
            ...chunk,
            content: truncatedContent
          });
        }
        break;
      }
    }
    
    return selected;
  }

  private findGoodTruncationPoint(content: string, maxLength: number): number {
    // Try to truncate at a good point (end of a hunk, line boundary, etc.)
    const truncateAt = maxLength - 100; // Leave some buffer
    
    // Look for hunk boundaries
    const hunkBoundary = content.lastIndexOf('\n@@', truncateAt);
    if (hunkBoundary > truncateAt * 0.7) {
      return hunkBoundary;
    }
    
    // Look for line boundaries
    const lineBoundary = content.lastIndexOf('\n', truncateAt);
    if (lineBoundary > truncateAt * 0.8) {
      return lineBoundary;
    }
    
    return truncateAt;
  }

  private generateSummary(chunks: DiffChunk[]): string {
    const totalFiles = chunks.length;
    const filesByType = chunks.reduce((acc, chunk) => {
      acc[chunk.changeType] = (acc[chunk.changeType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const totalLinesAdded = chunks.reduce((sum, chunk) => sum + chunk.linesAdded, 0);
    const totalLinesDeleted = chunks.reduce((sum, chunk) => sum + chunk.linesDeleted, 0);
    
    const parts = [`${totalFiles} files changed`];
    
    if (filesByType.added) parts.push(`${filesByType.added} added`);
    if (filesByType.deleted) parts.push(`${filesByType.deleted} deleted`);
    if (filesByType.modified) parts.push(`${filesByType.modified} modified`);
    if (filesByType.renamed) parts.push(`${filesByType.renamed} renamed`);
    
    parts.push(`+${totalLinesAdded}/-${totalLinesDeleted} lines`);
    
    return parts.join(', ');
  }
}