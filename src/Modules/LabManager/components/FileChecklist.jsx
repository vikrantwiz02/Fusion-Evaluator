import React, { useRef, useState } from 'react';
import { CheckSquare, Square, Plus, Trash2, ChevronRight, ChevronDown, Folder, FolderOpen, FilePlus, Edit2, Check, X } from 'lucide-react';

const DRAG_PATH_MIME = 'application/x-fusion-path';

function setAtPath(obj, parts, value) {
  if (parts.length === 1) return { ...obj, [parts[0]]: value };
  const [head, ...rest] = parts;
  const child = (obj[head] && typeof obj[head] === 'object') ? obj[head] : {};
  return { ...obj, [head]: setAtPath(child, rest, value) };
}

function deleteAtPath(obj, parts) {
  if (parts.length === 1) {
    const next = { ...obj };
    delete next[parts[0]];
    return next;
  }
  const [head, ...rest] = parts;
  if (!obj[head] || typeof obj[head] !== 'object') return obj;
  return { ...obj, [head]: deleteAtPath(obj[head], rest) };
}

function toggleAtPath(obj, parts) {
  if (parts.length === 1) return { ...obj, [parts[0]]: !obj[parts[0]] };
  const [head, ...rest] = parts;
  return { ...obj, [head]: toggleAtPath(obj[head], rest) };
}

function renameAtPath(obj, parts, newName) {
  if (!newName || !newName.trim()) return obj;
  const cleanedName = newName.trim().replace(/\//g, '');
  if (!cleanedName) return obj;

  if (parts.length === 1) {
    const oldName = parts[0];
    if (oldName === cleanedName || Object.prototype.hasOwnProperty.call(obj, cleanedName)) return obj;
    const next = { ...obj };
    const value = next[oldName];
    delete next[oldName];
    next[cleanedName] = value;
    return next;
  }

  const [head, ...rest] = parts;
  if (!obj[head] || typeof obj[head] !== 'object') return obj;
  return { ...obj, [head]: renameAtPath(obj[head], rest, cleanedName) };
}

function getAtPath(obj, parts) {
  let current = obj;
  for (const part of parts) {
    if (!current || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, part)) return undefined;
    current = current[part];
  }
  return current;
}

function withUniqueName(targetFolder = {}, baseName) {
  if (!Object.prototype.hasOwnProperty.call(targetFolder, baseName)) return baseName;
  let i = 2;
  let candidate = `${baseName}_${i}`;
  while (Object.prototype.hasOwnProperty.call(targetFolder, candidate)) {
    i += 1;
    candidate = `${baseName}_${i}`;
  }
  return candidate;
}

function isPathPrefix(prefix, full) {
  if (prefix.length > full.length) return false;
  return prefix.every((part, idx) => part === full[idx]);
}

function moveNode(tree, fromParts, toFolderParts) {
  if (!Array.isArray(fromParts) || fromParts.length === 0) return tree;
  if (!Array.isArray(toFolderParts)) return tree;
  if (isPathPrefix(fromParts, toFolderParts)) return tree;

  const node = getAtPath(tree, fromParts);
  if (node === undefined) return tree;

  const fromParentParts = fromParts.slice(0, -1);
  const originalName = fromParts[fromParts.length - 1];

  const pruned = deleteAtPath(tree, fromParts);
  const targetFolder = toFolderParts.length === 0 ? pruned : getAtPath(pruned, toFolderParts);
  if (toFolderParts.length > 0 && (!targetFolder || typeof targetFolder !== 'object' || Array.isArray(targetFolder))) {
    return tree;
  }

  // No-op if dropped back into same folder
  if (fromParentParts.length === toFolderParts.length && fromParentParts.every((part, idx) => part === toFolderParts[idx])) {
    return tree;
  }

  const safeName = withUniqueName(toFolderParts.length === 0 ? pruned : targetFolder, originalName);
  return setAtPath(pruned, [...toFolderParts, safeName], node);
}

function FileTree({
  nodes,
  onToggle,
  onDelete,
  onRename,
  onAdd,
  onMove,
  collapsed,
  onCollapse,
  draggedPath,
  setDraggedPath,
  getDragSource,
  dragOverTarget,
  setDragOverTarget,
  pathPrefix = [],
}) {
  // inlineAdd: pathKey → input value (null = hidden)
  const [inlineAdd, setInlineAdd] = useState({});
  const [inlineEdit, setInlineEdit] = useState({});

  const showInlineAdd = (pathKey) =>
    setInlineAdd((prev) => ({ ...prev, [pathKey]: prev[pathKey] == null ? '' : null }));

  const commitInlineAdd = (pathKey, folderPath) => {
    const val = (inlineAdd[pathKey] ?? '').trim();
    if (val) {
      const isFolder = val.endsWith('/');
      const parts = [...folderPath, ...val.replace(/\/+$/, '').split('/').filter(Boolean)];
      onAdd(parts, isFolder ? {} : false);
    }
    setInlineAdd((prev) => ({ ...prev, [pathKey]: null }));
  };

  const showInlineEdit = (pathKey, currentName) => {
    setInlineEdit((prev) => ({ ...prev, [pathKey]: currentName }));
  };

  const commitInlineEdit = (pathKey, currentPath) => {
    const val = (inlineEdit[pathKey] ?? '').trim();
    if (val) onRename(currentPath, val);
    setInlineEdit((prev) => ({ ...prev, [pathKey]: null }));
  };

  return (
    <div>
      {Object.entries(nodes).map(([name, value]) => {
        const currentPath = [...pathPrefix, name];
        const pathKey = currentPath.join('/');
        const isFolder = value !== null && typeof value === 'object';

        if (isFolder) {
          const isCollapsed = collapsed[pathKey];
          const addInputValue = inlineAdd[pathKey];
          const addOpen = addInputValue != null;
          const editInputValue = inlineEdit[pathKey];
          const editOpen = editInputValue != null;

          return (
            <div key={name}>
              <div
                className={`flex items-center justify-between text-sm hover:bg-slate-50 p-1.5 rounded transition-colors group border hover:border-slate-200 ${dragOverTarget === `folder:${pathKey}` ? 'border-indigo-300 bg-indigo-50/60' : 'border-transparent'}`}
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData(DRAG_PATH_MIME, pathKey);
                  e.dataTransfer.setData('text/plain', pathKey);
                  setDraggedPath(pathKey);
                }}
                onDragEnd={() => window.setTimeout(() => setDraggedPath(''), 0)}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragOverTarget(`folder:${pathKey}`);
                }}
                onDragLeave={(e) => {
                  if (e.currentTarget.contains(e.relatedTarget)) return;
                  setDragOverTarget('');
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const source = getDragSource(e);
                  if (!source || source === pathKey) return;
                  onMove(source.split('/').filter(Boolean), currentPath);
                  setDraggedPath('');
                  setDragOverTarget('');
                }}
              >
                {editOpen ? (
                  <div className="flex items-center w-full space-x-1.5">
                    <input
                      autoFocus
                      type="text"
                      value={editInputValue}
                      onChange={(e) => setInlineEdit((prev) => ({ ...prev, [pathKey]: e.target.value }))}
                      className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-400"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitInlineEdit(pathKey, currentPath);
                        if (e.key === 'Escape') setInlineEdit((prev) => ({ ...prev, [pathKey]: null }));
                      }}
                    />
                    <button
                      onMouseDown={(e) => { e.preventDefault(); commitInlineEdit(pathKey, currentPath); }}
                      className="p-1 text-emerald-600 hover:text-emerald-700 cursor-pointer"
                      title="Save"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); setInlineEdit((prev) => ({ ...prev, [pathKey]: null })); }}
                      className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div
                      className="flex items-center space-x-1.5 cursor-pointer flex-1 min-w-0"
                      onClick={() => onCollapse(pathKey)}
                    >
                      {isCollapsed
                        ? <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        : <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      }
                      {isCollapsed
                        ? <Folder className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        : <FolderOpen className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      }
                      <span className="font-medium text-gray-600 truncate" title={name}>{name}</span>
                    </div>

                    <div className="flex items-center space-x-0.5 flex-shrink-0">
                      <button
                        title="Edit"
                        onClick={(e) => { e.stopPropagation(); showInlineEdit(pathKey, name); }}
                        className="p-1 text-gray-400 hover:text-indigo-500 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                  {/* Add file inside folder */}
                  <button
                    title="Add file inside"
                    onClick={(e) => { e.stopPropagation(); onCollapse(pathKey, false); showInlineAdd(pathKey); }}
                    className="p-1 text-gray-400 hover:text-indigo-500 cursor-pointer"
                  >
                    <FilePlus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDelete(currentPath)}
                    className="p-1 text-gray-400 hover:text-red-500 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                  </>
                )}
              </div>

              {!isCollapsed && (
                <div
                  className={`ml-4 pl-2 border-l-2 border-gray-100 ${dragOverTarget === `folder-body:${pathKey}` ? 'bg-indigo-50/30' : ''}`}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setDragOverTarget(`folder-body:${pathKey}`);
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget)) return;
                    setDragOverTarget('');
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const source = getDragSource(e);
                    if (!source || source === pathKey) return;
                    onMove(source.split('/').filter(Boolean), currentPath);
                    setDraggedPath('');
                    setDragOverTarget('');
                  }}
                >
                  <FileTree
                    nodes={value}
                    onToggle={onToggle}
                    onDelete={onDelete}
                    onRename={onRename}
                    onAdd={onAdd}
                    onMove={onMove}
                    collapsed={collapsed}
                    onCollapse={onCollapse}
                    draggedPath={draggedPath}
                    setDraggedPath={setDraggedPath}
                    getDragSource={getDragSource}
                    dragOverTarget={dragOverTarget}
                    setDragOverTarget={setDragOverTarget}
                    pathPrefix={currentPath}
                  />

                  {/* Inline add input inside folder */}
                  {addOpen && (
                    <div className="flex items-center space-x-1.5 mt-1 mb-0.5">
                      <input
                        autoFocus
                        type="text"
                        value={addInputValue}
                        onChange={(e) => setInlineAdd((prev) => ({ ...prev, [pathKey]: e.target.value }))}
                        placeholder="filename.py or sub/"
                        className="flex-1 text-xs border border-indigo-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-400"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitInlineAdd(pathKey, currentPath);
                          if (e.key === 'Escape') setInlineAdd((prev) => ({ ...prev, [pathKey]: null }));
                        }}
                        onBlur={() => commitInlineAdd(pathKey, currentPath)}
                      />
                      <button
                        onMouseDown={(e) => { e.preventDefault(); commitInlineAdd(pathKey, currentPath); }}
                        className="bg-indigo-50 text-indigo-600 p-1 rounded hover:bg-indigo-100 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        }

        const editInputValue = inlineEdit[pathKey];
        const editOpen = editInputValue != null;

        return (
          <div
            key={name}
            className={`flex items-center justify-between text-sm hover:bg-slate-50 p-1.5 rounded transition-colors group border hover:border-slate-200 ${dragOverTarget === `file:${pathKey}` ? 'border-indigo-300 bg-indigo-50/60' : 'border-transparent'}`}
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData(DRAG_PATH_MIME, pathKey);
              e.dataTransfer.setData('text/plain', pathKey);
              setDraggedPath(pathKey);
            }}
            onDragEnd={() => window.setTimeout(() => setDraggedPath(''), 0)}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOverTarget(`file:${pathKey}`);
            }}
            onDragLeave={(e) => {
              if (e.currentTarget.contains(e.relatedTarget)) return;
              setDragOverTarget('');
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e) => {
              e.preventDefault();
              const source = getDragSource(e);
              if (!source || source === pathKey) return;
              onMove(source.split('/').filter(Boolean), pathPrefix);
              setDraggedPath('');
              setDragOverTarget('');
            }}
          >
            {editOpen ? (
              <div className="flex items-center w-full space-x-1.5">
                <input
                  autoFocus
                  type="text"
                  value={editInputValue}
                  onChange={(e) => setInlineEdit((prev) => ({ ...prev, [pathKey]: e.target.value }))}
                  className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-400"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitInlineEdit(pathKey, currentPath);
                    if (e.key === 'Escape') setInlineEdit((prev) => ({ ...prev, [pathKey]: null }));
                  }}
                />
                <button
                  onMouseDown={(e) => { e.preventDefault(); commitInlineEdit(pathKey, currentPath); }}
                  className="p-1 text-emerald-600 hover:text-emerald-700 cursor-pointer"
                  title="Save"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onMouseDown={(e) => { e.preventDefault(); setInlineEdit((prev) => ({ ...prev, [pathKey]: null })); }}
                  className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer"
                  title="Cancel"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <div
                  className="flex items-center space-x-2 cursor-pointer flex-1 overflow-hidden"
                  onClick={() => onToggle(currentPath)}
                >
                  {value
                    ? <CheckSquare className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    : <Square className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  }
                  <span className={`truncate ${value ? 'text-gray-700' : 'text-gray-400'}`} title={name}>
                    {name}
                  </span>
                </div>
                <div className="flex items-center space-x-0.5 flex-shrink-0">
                  <button
                    onClick={() => showInlineEdit(pathKey, name)}
                    className="p-1 text-gray-400 hover:text-indigo-500 cursor-pointer"
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDelete(currentPath)}
                    className="p-1 text-gray-400 hover:text-red-500 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function FileChecklist({ title, files, onUpdate }) {
  const [newEntry, setNewEntry] = useState('');
  const [collapsed, setCollapsed] = useState({});
  const [draggedPath, setDraggedPath] = useState('');
  const [dragOverTarget, setDragOverTarget] = useState('');
  const draggedPathRef = useRef('');

  const setDragPath = (path) => {
    draggedPathRef.current = path || '';
    setDraggedPath(path || '');
  };

  const getDragSource = (event) => (
    event?.dataTransfer?.getData(DRAG_PATH_MIME)
    || event?.dataTransfer?.getData('text/plain')
    || event?.dataTransfer?.getData('text')
    || draggedPathRef.current
    || draggedPath
    || ''
  );

  if (!files) return null;

  const handleToggle = (pathParts) => onUpdate(toggleAtPath(files, pathParts));
  const handleDelete = (pathParts) => onUpdate(deleteAtPath(files, pathParts));
  const handleRename = (pathParts, newName) => onUpdate(renameAtPath(files, pathParts, newName));
  const handleAdd = (pathParts, value) => onUpdate(setAtPath(files, pathParts, value));
  const handleMove = (fromParts, toFolderParts) => onUpdate(moveNode(files, fromParts, toFolderParts));

  // onCollapse: forceExpand=false means keep current, forceExpand=true means force open
  const handleCollapse = (pathKey, forceExpand) => {
    if (forceExpand === false) {
      setCollapsed((prev) => ({ ...prev, [pathKey]: false }));
    } else {
      setCollapsed((prev) => ({ ...prev, [pathKey]: !prev[pathKey] }));
    }
  };

  const handleRootAdd = () => {
    const trimmed = newEntry.trim();
    if (!trimmed) return;
    const isFolder = trimmed.endsWith('/');
    const parts = trimmed.replace(/\/+$/, '').split('/').filter(Boolean);
    if (parts.length === 0) return;
    onUpdate(setAtPath(files, parts, isFolder ? {} : false));
    setNewEntry('');
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">{title}</h3>

      <div className="mb-4">
        <div
          className={dragOverTarget === 'root' ? 'rounded-lg ring-2 ring-indigo-200 bg-indigo-50/40 p-1' : ''}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOverTarget('root');
          }}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget)) return;
            setDragOverTarget('');
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(e) => {
            e.preventDefault();
            const source = getDragSource(e);
            if (!source) return;
            handleMove(source.split('/').filter(Boolean), []);
            setDragPath('');
            setDragOverTarget('');
          }}
        >
          <FileTree
            nodes={files}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onRename={handleRename}
            onAdd={handleAdd}
            onMove={handleMove}
            collapsed={collapsed}
            onCollapse={handleCollapse}
            draggedPath={draggedPath}
            setDraggedPath={setDragPath}
            getDragSource={getDragSource}
            dragOverTarget={dragOverTarget}
            setDragOverTarget={setDragOverTarget}
          />
        </div>
      </div>

      <div className="border-t border-gray-100 pt-3 space-y-1.5">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={newEntry}
            onChange={(e) => setNewEntry(e.target.value)}
            placeholder="file.py or folder/"
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            onKeyDown={(e) => e.key === 'Enter' && handleRootAdd()}
          />
          <button
            onClick={handleRootAdd}
            className="bg-indigo-50 text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-100 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-400">
          End with <span className="font-mono">/</span> to create a folder &nbsp;·&nbsp; hover a folder to add inside it
        </p>
      </div>
    </div>
  );
}
