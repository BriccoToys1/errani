import { NextRequest, NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-auth';
import fs from 'fs/promises';
import path from 'path';

// Base directory for file operations (public folder only for security)
const PUBLIC_DIR = path.resolve('public');

// Allowed extensions for editing
const EDITABLE_EXTENSIONS = ['.txt', '.md', '.json', '.css', '.xml'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.ico', '.svg'];
const MAX_EDITABLE_BYTES = 1024 * 1024;

function resolvePublicPath(filePath: unknown): string | null {
  if (typeof filePath !== 'string' || filePath.includes('\0') || path.isAbsolute(filePath)) return null;
  const resolvedPath = path.resolve(PUBLIC_DIR, filePath);
  const relative = path.relative(PUBLIC_DIR, resolvedPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return resolvedPath;
}

async function containsSymlink(fullPath: string): Promise<boolean> {
  const relative = path.relative(PUBLIC_DIR, fullPath);
  let cursor = PUBLIC_DIR;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    try {
      const stats = await fs.lstat(cursor);
      if (stats.isSymbolicLink()) return true;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw error;
    }
  }
  return false;
}

function isEditableFile(fullPath: string): boolean {
  return EDITABLE_EXTENSIONS.includes(path.extname(fullPath).toLowerCase());
}

// GET: List files or read file content
export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const relativePath = url.searchParams.get('path') || '';
  const action = url.searchParams.get('action') || 'list';

  const fullPath = resolvePublicPath(relativePath);
  if (!fullPath || await containsSymlink(fullPath)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  try {
    if (action === 'read') {
      if (!isEditableFile(fullPath)) {
        return NextResponse.json({ error: 'File type is not editable' }, { status: 400 });
      }
      // Read file content
      const stats = await fs.stat(fullPath);
      if (!stats.isFile() || stats.size > MAX_EDITABLE_BYTES) {
        return NextResponse.json({ error: 'File is too large or is not a regular file' }, { status: 400 });
      }
      const content = await fs.readFile(fullPath, 'utf-8');
      return NextResponse.json({
        path: relativePath,
        content,
        size: stats.size,
        modified: stats.mtime.toISOString(),
      });
    }

    // List directory
    const stats = await fs.stat(fullPath);
    if (!stats.isDirectory()) {
      return NextResponse.json({ error: 'Not a directory' }, { status: 400 });
    }

    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    const items = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(fullPath, entry.name);
        const entryStats = await fs.stat(entryPath);
        const ext = path.extname(entry.name).toLowerCase();
        
        return {
          name: entry.name,
          path: path.join(relativePath, entry.name),
          isDirectory: entry.isDirectory(),
          size: entryStats.size,
          modified: entryStats.mtime.toISOString(),
          isEditable: EDITABLE_EXTENSIONS.includes(ext),
          isImage: IMAGE_EXTENSIONS.includes(ext),
          extension: ext,
        };
      })
    );

    // Sort: directories first, then files
    items.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      path: relativePath,
      items,
      parent: relativePath ? path.dirname(relativePath) : null,
    });
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return NextResponse.json({ error: 'Path not found' }, { status: 404 });
    }
    console.error('File API error:', error);
    return NextResponse.json({ error: 'Failed to read path' }, { status: 500 });
  }
}

// POST: Create file or directory
export async function POST(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const { path: relativePath, content, isDirectory } = body;

    const fullPath = resolvePublicPath(relativePath);
    if (!relativePath || !fullPath || await containsSymlink(fullPath)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    if (isDirectory) {
      await fs.mkdir(fullPath, { recursive: true });
      return NextResponse.json({ success: true, message: 'Directory created' });
    }

    // Create file with content
    if (!isEditableFile(fullPath) || typeof content !== 'string' || Buffer.byteLength(content, 'utf8') > MAX_EDITABLE_BYTES) {
      return NextResponse.json({ error: 'Unsupported file type or file too large' }, { status: 400 });
    }
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content || '', 'utf-8');

    return NextResponse.json({ success: true, message: 'File created' });
  } catch (error) {
    console.error('Create file error:', error);
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}

// PUT: Update file content
export async function PUT(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const { path: relativePath, content } = body;

    const fullPath = resolvePublicPath(relativePath);
    if (!relativePath || !fullPath || await containsSymlink(fullPath)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }
    if (!isEditableFile(fullPath) || typeof content !== 'string' || Buffer.byteLength(content, 'utf8') > MAX_EDITABLE_BYTES) {
      return NextResponse.json({ error: 'Unsupported file type or file too large' }, { status: 400 });
    }
    
    // Check if file exists
    await fs.access(fullPath);
    
    // Write content
    await fs.writeFile(fullPath, content, 'utf-8');

    return NextResponse.json({ success: true, message: 'File updated' });
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    console.error('Update file error:', error);
    return NextResponse.json({ error: 'Failed to update file' }, { status: 500 });
  }
}

// DELETE: Delete file or directory
export async function DELETE(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const relativePath = url.searchParams.get('path');

  const fullPath = resolvePublicPath(relativePath);
  if (!relativePath || !fullPath || await containsSymlink(fullPath)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  try {
    const stats = await fs.stat(fullPath);
    
    if (stats.isDirectory()) {
      await fs.rm(fullPath, { recursive: true });
    } else {
      await fs.unlink(fullPath);
    }

    return NextResponse.json({ success: true, message: 'Deleted successfully' });
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return NextResponse.json({ error: 'Path not found' }, { status: 404 });
    }
    console.error('Delete error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
