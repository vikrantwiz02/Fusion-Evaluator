import React, { useState } from 'react';
import { Plus, Trash2, CheckCircle, Circle, Calendar } from 'lucide-react';

export default function FeatureList({ features = [], onUpdate, hasBackend = true, hasFrontend = true }) {
  const [newFeature, setNewFeature] = useState('');
  const [newFeatureDate, setNewFeatureDate] = useState(new Date().toISOString().split('T')[0]);

  const handleAdd = () => {
    if (newFeature.trim()) {
      const dateStr = newFeatureDate ? ` (${newFeatureDate})` : '';
      onUpdate([...features, { id: Date.now(), name: newFeature.trim() + dateStr, backend: false, frontend: false, is_functional: false }]);
      setNewFeature('');
    }
  };

  const toggleFeature = (id, type) => {
    onUpdate(features.map(f => f.id === id ? { ...f, [type]: !f[type] } : f));
  };

  const handleDelete = (id) => {
    onUpdate(features.filter(f => f.id !== id));
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Features Integration</h3>
        <span className="bg-indigo-100 text-indigo-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
          {features.length}
        </span>
      </div>

      <div className="space-y-3 mb-4">
        {features.map(feature => (
          <div key={feature.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100 group">
            <span className="font-medium text-gray-800 mb-2 sm:mb-0">{feature.name}</span>
            <div className="flex items-center space-x-4">
              {hasBackend && (
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input type="checkbox" checked={feature.backend} onChange={() => toggleFeature(feature.id, 'backend')} className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" />
                  <span className="text-sm text-gray-600">Backend</span>
                </label>
              )}
              {hasFrontend && (
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input type="checkbox" checked={feature.frontend} onChange={() => toggleFeature(feature.id, 'frontend')} className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" />
                  <span className="text-sm text-gray-600">Frontend</span>
                </label>
              )}
              <div className="w-px h-4 bg-gray-300 mx-2 hidden sm:block"></div>
              <label className="flex items-center space-x-1.5 cursor-pointer w-24">
                <input type="checkbox" checked={feature.is_functional || false} onChange={() => toggleFeature(feature.id, 'is_functional')} className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500" />
                <span className={`text-sm ${feature.is_functional ? 'text-emerald-700 font-medium' : 'text-gray-500'}`}>Functional</span>
              </label>
              <button onClick={() => handleDelete(feature.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {features.length === 0 && <p className="text-sm text-gray-500 italic">No features added yet.</p>}
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="text"
          value={newFeature}
          onChange={(e) => setNewFeature(e.target.value)}
          placeholder="Add new feature..."
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <input
          type="date"
          value={newFeatureDate}
          onChange={(e) => setNewFeatureDate(e.target.value)}
          className="w-36 text-sm border border-gray-200 rounded-lg px-2 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-gray-600"
          title="Implementation Date"
        />
        <button onClick={handleAdd} className="bg-indigo-50 text-indigo-600 p-2 rounded-lg hover:bg-indigo-100 transition-colors cursor-pointer" title="Add Feature">
          <Plus className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
