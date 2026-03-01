'use client';

import { FIELD_TYPES, FieldType } from './types';

interface FieldPaletteProps {
  onDragStart: (type: FieldType) => void;
  onDragEnd: () => void;
}

export function FieldPalette({ onDragStart, onDragEnd }: FieldPaletteProps) {
  const categories = [...new Set(FIELD_TYPES.map((f) => f.category))];

  return (
    <div className="field-palette">
      {categories.map((category) => (
        <div key={category} className="mb-3">
          <div className="text-muted small mb-2">{category}</div>
          <div className="d-flex flex-wrap gap-1">
            {FIELD_TYPES.filter((f) => f.category === category).map((field) => (
              <div
                key={field.type}
                className="palette-item"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('fieldType', field.type);
                  onDragStart(field.type);
                }}
                onDragEnd={onDragEnd}
                title={field.label}
              >
                <span className="palette-icon">{field.icon}</span>
                <span className="palette-label">{field.label}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <style jsx>{`
        .palette-item {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 4px;
          cursor: grab;
          font-size: 12px;
          transition: all 0.2s;
          user-select: none;
        }
        .palette-item:hover {
          background: #e9ecef;
          border-color: #0d6efd;
        }
        .palette-item:active {
          cursor: grabbing;
        }
        .palette-icon {
          width: 18px;
          text-align: center;
          font-size: 14px;
        }
        .palette-label {
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}
