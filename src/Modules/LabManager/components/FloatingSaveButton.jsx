import React, { useEffect, useRef, useState } from 'react';
import { Save } from 'lucide-react';

export default function FloatingSaveButton({ onSave, saveStatus }) {
  const [pos, setPos] = useState(() => ({
    x: window.innerWidth - 180,
    y: window.innerHeight - 100,
  }));
  const posRef = useRef(pos);
  const dragState = useRef({ active: false, moved: false, offsetX: 0, offsetY: 0 });

  // Keep posRef in sync with latest pos so drag handlers always read current position
  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragState.current.active) return;
      dragState.current.moved = true;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 120, e.clientX - dragState.current.offsetX)),
        y: Math.max(0, Math.min(window.innerHeight - 44, e.clientY - dragState.current.offsetY)),
      });
    };
    const onMouseUp = () => {
      dragState.current.active = false;
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const handleMouseDown = (e) => {
    dragState.current = {
      active: true,
      moved: false,
      offsetX: e.clientX - posRef.current.x,
      offsetY: e.clientY - posRef.current.y,
    };
    e.preventDefault();
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (dragState.current.moved) return;
    if (saveStatus !== 'saving') onSave();
  };

  const isSaving = saveStatus === 'saving';
  const isSaved = saveStatus === 'saved';
  const isError = saveStatus === 'error';

  return (
    <div
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 9999,
        userSelect: 'none',
        cursor: isSaving ? 'wait' : 'grab',
      }}
      onMouseDown={handleMouseDown}
    >
      <button
        onClick={handleClick}
        disabled={isSaving}
        title="Save pair data manually — drag to reposition"
        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-xl border transition-colors select-none
          ${isSaving
            ? 'bg-amber-50 text-amber-700 border-amber-200'
            : isSaved
            ? 'bg-emerald-500 text-white border-emerald-500'
            : isError
            ? 'bg-red-50 text-red-700 border-red-300'
            : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'}`}
      >
        {isSaving ? (
          <span className="w-4 h-4 rounded-full border-2 border-amber-300 border-t-amber-600 animate-spin inline-block" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        {isSaving ? 'Saving…' : isSaved ? 'Saved!' : isError ? 'Failed' : 'Save Pair'}
      </button>
    </div>
  );
}
