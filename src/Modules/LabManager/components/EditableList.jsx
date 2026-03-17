import React, { useState } from 'react';
import { Plus, X, Edit2, Check, Calendar } from 'lucide-react';

export default function EditableList({ title, items, onUpdate, icon: Icon }) {
  const [newItem, setNewItem] = useState('');
  const [newItemDate, setNewItemDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editValue, setEditValue] = useState('');

  const handleAdd = () => {
    if (newItem.trim()) {
      const dateStr = newItemDate ? ` (${newItemDate})` : '';
      onUpdate([...items, newItem.trim() + dateStr]);
      setNewItem('');
    }
  };

  const handleDelete = (index) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    onUpdate(newItems);
  };

  const handleEditSave = (index) => {
    if (editValue.trim()) {
      const newItems = [...items];
      newItems[index] = editValue.trim();
      onUpdate(newItems);
    }
    setEditingIndex(null);
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">{title}</h3>
        <span className="bg-indigo-100 text-indigo-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
          {items.length}
        </span>
      </div>
      
      <div className="space-y-2 mb-3">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-100 group">
            {editingIndex === idx ? (
              <div className="flex items-center w-full space-x-2">
                <input 
                  type="text" 
                  value={editValue} 
                  onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 outline-none focus:border-indigo-500"
                  autoFocus
                />
                <button onClick={() => handleEditSave(idx)} className="text-emerald-600 hover:text-emerald-700 cursor-pointer"><Check className="w-4 h-4" /></button>
                <button onClick={() => setEditingIndex(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <>
                <div className="flex items-center text-sm text-gray-700 font-mono truncate">
                  {Icon && <Icon className="w-3 h-3 mr-2 text-slate-400 flex-shrink-0" />}
                  <span className="truncate" title={item}>{item}</span>
                </div>
                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button onClick={() => { setEditingIndex(idx); setEditValue(item); }} className="p-1 text-gray-400 hover:text-indigo-600 cursor-pointer"><Edit2 className="w-3 h-3" /></button>
                  <button onClick={() => handleDelete(idx)} className="p-1 text-gray-400 hover:text-red-600 cursor-pointer"><X className="w-3 h-3" /></button>
                </div>
              </>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-gray-500 italic">No items found.</p>}
      </div>

      <div className="flex items-center space-x-2 mt-2">
        <input 
          type="text" 
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add new item..."
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <input 
          type="date"
          value={newItemDate}
          onChange={(e) => setNewItemDate(e.target.value)}
          className="w-32 text-sm border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-gray-600"
          title="Implementation Date"
        />
        <button onClick={handleAdd} className="bg-indigo-50 text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-100 transition-colors cursor-pointer" title="Add Item">
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
