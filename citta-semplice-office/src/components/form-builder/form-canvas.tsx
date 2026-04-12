'use client';

import { useState, Fragment } from 'react';
import { FormField, FieldType, FIELD_TYPES } from './types';

interface FormCanvasProps {
  fields: FormField[];
  selectedFieldId: string | null;
  draggedType: FieldType | null;
  dragOverIndex: number | null;
  onDrop: (index: number) => void;
  onDragOver: (index: number | null) => void;
  onSelect: (fieldId: string) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  onDuplicate: (fieldId: string) => void;
  onDelete: (fieldId: string) => void;
}

export function FormCanvas({
  fields,
  selectedFieldId,
  draggedType,
  dragOverIndex,
  onDrop,
  onDragOver,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
}: FormCanvasProps) {
  const [draggedFieldIndex, setDraggedFieldIndex] = useState<number | null>(null);

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    onDragOver(index);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedFieldIndex !== null) {
      onMove(draggedFieldIndex, index);
      setDraggedFieldIndex(null);
    } else {
      onDrop(index);
    }
    onDragOver(null);
  };

  const handleFieldDragStart = (e: React.DragEvent, index: number) => {
    setDraggedFieldIndex(index);
    e.dataTransfer.setData('fieldIndex', String(index));
  };

  const handleFieldDragEnd = () => {
    setDraggedFieldIndex(null);
    onDragOver(null);
  };

  const getFieldTypeInfo = (type: FieldType) => {
    return FIELD_TYPES.find((f) => f.type === type);
  };

  const renderFieldPreview = (field: FormField) => {
    const typeInfo = getFieldTypeInfo(field.type);

    switch (field.type) {
      case 'heading':
        return <h5 className="mb-0">{field.label || 'Titolo'}</h5>;

      case 'paragraph':
        return <p className="mb-0 text-muted">{field.label || 'Testo paragrafo'}</p>;

      case 'divider':
        return <hr className="my-0" />;

      case 'hidden':
        return (
          <div className="text-muted small">
            <span className="me-2">👁</span>
            Campo nascosto: {field.name}
          </div>
        );

      case 'checkbox':
        return (
          <div className="form-check">
            <input type="checkbox" className="form-check-input" disabled />
            <label className="form-check-label">
              {field.label}
              {field.validation?.required && <span className="text-danger ms-1">*</span>}
            </label>
          </div>
        );

      case 'radio':
        return (
          <div>
            <label className="form-label">
              {field.label}
              {field.validation?.required && <span className="text-danger ms-1">*</span>}
            </label>
            {field.options?.map((opt, i) => (
              <div key={i} className="form-check">
                <input
                  type="radio"
                  className="form-check-input"
                  name={`preview_${field.id}`}
                  disabled
                />
                <label className="form-check-label">{opt.label}</label>
              </div>
            ))}
          </div>
        );

      case 'select':
        return (
          <div>
            <label className="form-label">
              {field.label}
              {field.validation?.required && <span className="text-danger ms-1">*</span>}
            </label>
            <select className="form-select form-select-sm" disabled>
              {field.options?.map((opt, i) => (
                <option key={i} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        );

      case 'textarea':
        return (
          <div>
            <label className="form-label">
              {field.label}
              {field.validation?.required && <span className="text-danger ms-1">*</span>}
            </label>
            <textarea
              className="form-control form-control-sm"
              placeholder={field.placeholder}
              rows={2}
              disabled
            />
          </div>
        );

      case 'file':
        return (
          <div>
            <label className="form-label">
              {field.label}
              {field.validation?.required && <span className="text-danger ms-1">*</span>}
            </label>
            <input type="file" className="form-control form-control-sm" disabled />
            {field.accept && (
              <small className="text-muted">Formati: {field.accept}</small>
            )}
          </div>
        );

      default:
        return (
          <div>
            <label className="form-label">
              {field.label}
              {field.validation?.required && <span className="text-danger ms-1">*</span>}
            </label>
            <input
              type={field.type}
              className="form-control form-control-sm"
              placeholder={field.placeholder}
              disabled
            />
          </div>
        );
    }
  };

  return (
    <div className="form-canvas">
      {/* Drop zone at top */}
      <div
        className={`drop-zone ${dragOverIndex === 0 ? 'active' : ''} ${
          (draggedType || draggedFieldIndex !== null) ? 'visible' : ''
        }`}
        onDragOver={(e) => handleDragOver(e, 0)}
        onDrop={(e) => handleDrop(e, 0)}
      >
        Rilascia qui
      </div>

      {fields.length === 0 ? (
        <div className="empty-canvas">
          <div className="text-center text-muted py-5">
            <div style={{ fontSize: '48px', opacity: 0.3 }}>📋</div>
            <p className="mt-3">
              Trascina i componenti dalla palette per costruire il form
            </p>
          </div>
        </div>
      ) : (
        fields.map((field, index) => (
          <Fragment key={index}>
            <div
              className={`field-item ${selectedFieldId === field.id ? 'selected' : ''} ${
                draggedFieldIndex === index ? 'dragging' : ''
              }`}
              draggable
              onDragStart={(e) => handleFieldDragStart(e, index)}
              onDragEnd={handleFieldDragEnd}
              onClick={() => onSelect(field.id)}
            >
              <div className="field-header">
                <span className="field-type-badge">
                  {getFieldTypeInfo(field.type)?.icon} {getFieldTypeInfo(field.type)?.label}
                </span>
                <div className="field-actions">
                  <button
                    type="button"
                    className="btn btn-sm btn-link p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicate(field.id);
                    }}
                    title="Duplica"
                  >
                    📋
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-link p-0 text-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(field.id);
                    }}
                    title="Elimina"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="field-preview">{renderFieldPreview(field)}</div>
              <div className="field-footer">
                {field.name && <code>{field.name}</code>}
                {field.condition?.fieldName && (
                  <span className="condition-badge" title={`Visibile se "${field.condition.fieldName}" ${field.condition.operator}${field.condition.value ? ` "${field.condition.value}"` : ''}`}>
                    ◈ condizione
                  </span>
                )}
              </div>
            </div>

            {/* Drop zone after each field */}
            <div
              className={`drop-zone ${dragOverIndex === index + 1 ? 'active' : ''} ${
                (draggedType || draggedFieldIndex !== null) ? 'visible' : ''
              }`}
              onDragOver={(e) => handleDragOver(e, index + 1)}
              onDrop={(e) => handleDrop(e, index + 1)}
            >
              Rilascia qui
            </div>
          </Fragment>
        ))
      )}

      <style jsx>{`
        .form-canvas {
          min-height: 400px;
          background: #fafafa;
          border: 2px dashed #dee2e6;
          border-radius: 8px;
          padding: 16px;
        }
        .drop-zone {
          height: 4px;
          margin: 4px 0;
          border-radius: 4px;
          transition: all 0.2s;
          opacity: 0;
        }
        .drop-zone.visible {
          opacity: 0.3;
          height: 8px;
          background: #dee2e6;
        }
        .drop-zone.active {
          opacity: 1;
          height: 40px;
          background: #0d6efd;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
        }
        .field-item {
          background: white;
          border: 2px solid #dee2e6;
          border-radius: 8px;
          padding: 12px;
          margin: 8px 0;
          cursor: grab;
          transition: all 0.2s;
        }
        .field-item:hover {
          border-color: #0d6efd;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        .field-item.selected {
          border-color: #0d6efd;
          box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.25);
        }
        .field-item.dragging {
          opacity: 0.5;
        }
        .field-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          padding-bottom: 8px;
          border-bottom: 1px solid #eee;
        }
        .field-type-badge {
          font-size: 11px;
          color: #6c757d;
        }
        .field-actions {
          display: flex;
          gap: 8px;
        }
        .field-actions button {
          font-size: 14px;
          opacity: 0.5;
        }
        .field-actions button:hover {
          opacity: 1;
        }
        .field-preview {
          font-size: 14px;
        }
        .field-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px dashed #eee;
        }
        .field-footer code {
          font-size: 11px;
          color: #6c757d;
        }
        .condition-badge {
          font-size: 10px;
          color: #0d6efd;
          background: #e7f1ff;
          padding: 1px 6px;
          border-radius: 10px;
        }
        .empty-canvas {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 300px;
        }
      `}</style>
    </div>
  );
}
