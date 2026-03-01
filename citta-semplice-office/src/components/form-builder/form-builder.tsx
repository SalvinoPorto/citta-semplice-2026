'use client';

import { useState, useCallback } from 'react';
import { Card, CardBody, Button, Alert } from '@/components/ui';
import { FieldPalette } from './field-palette';
import { FieldEditor } from './field-editor';
import { FormCanvas } from './form-canvas';
import { FormPreview } from './form-preview';
import { FormField, FormSchema, FieldType, createDefaultField } from './types';

interface FormBuilderProps {
  initialSchema?: FormSchema;
  onChange: (schema: FormSchema) => void;
}

export function FormBuilder({ initialSchema, onChange }: FormBuilderProps) {
  const [fields, setFields] = useState<FormField[]>(initialSchema?.fields || []);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [draggedType, setDraggedType] = useState<FieldType | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [view, setView] = useState<'builder' | 'preview' | 'json'>('builder');

  const selectedField = fields.find((f) => f.id === selectedFieldId) || null;

  const updateSchema = useCallback(
    (newFields: FormField[]) => {
      setFields(newFields);
      onChange({ fields: newFields, version: '1.0' });
    },
    [onChange]
  );

  const handleDragStart = (type: FieldType) => {
    setDraggedType(type);
  };

  const handleDragEnd = () => {
    setDraggedType(null);
    setDragOverIndex(null);
  };

  const handleDrop = (index: number) => {
    if (draggedType) {
      const newField = createDefaultField(draggedType);
      const newFields = [...fields];
      newFields.splice(index, 0, newField);
      updateSchema(newFields);
      setSelectedFieldId(newField.id);
    }
    setDraggedType(null);
    setDragOverIndex(null);
  };

  const handleFieldMove = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const newFields = [...fields];
    const [removed] = newFields.splice(fromIndex, 1);
    newFields.splice(toIndex > fromIndex ? toIndex - 1 : toIndex, 0, removed);
    updateSchema(newFields);
  };

  const handleFieldUpdate = (updatedField: FormField) => {
    const newFields = fields.map((f) => (f.id === updatedField.id ? updatedField : f));
    updateSchema(newFields);
  };

  const handleFieldDuplicate = (fieldId: string) => {
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return;
    const index = fields.findIndex((f) => f.id === fieldId);
    const newField: FormField = {
      ...field,
      id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `${field.name}_copia`,
    };
    const newFields = [...fields];
    newFields.splice(index + 1, 0, newField);
    updateSchema(newFields);
    setSelectedFieldId(newField.id);
  };

  const handleFieldDelete = (fieldId: string) => {
    const newFields = fields.filter((f) => f.id !== fieldId);
    updateSchema(newFields);
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(null);
    }
  };

  const handleSelectField = (fieldId: string) => {
    setSelectedFieldId(fieldId === selectedFieldId ? null : fieldId);
  };

  return (
    <div className="form-builder">
      {/* Toolbar */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="btn-group">
          <button
            type="button"
            className={`btn btn-sm ${view === 'builder' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setView('builder')}
          >
            Editor
          </button>
          <button
            type="button"
            className={`btn btn-sm ${view === 'preview' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setView('preview')}
          >
            Anteprima
          </button>
          <button
            type="button"
            className={`btn btn-sm ${view === 'json' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setView('json')}
          >
            JSON
          </button>
        </div>
        <div className="text-muted small">
          {fields.length} {fields.length === 1 ? 'campo' : 'campi'}
        </div>
      </div>

      {view === 'builder' && (
        <div className="row">
          {/* Left: Field Palette */}
          <div className="col-md-3">
            <Card>
              <CardBody>
                <h6 className="mb-3">Componenti</h6>
                <FieldPalette onDragStart={handleDragStart} onDragEnd={handleDragEnd} />
              </CardBody>
            </Card>
          </div>

          {/* Center: Canvas */}
          <div className="col-md-6">
            <Card>
              <CardBody>
                <h6 className="mb-3">Form</h6>
                <FormCanvas
                  fields={fields}
                  selectedFieldId={selectedFieldId}
                  draggedType={draggedType}
                  dragOverIndex={dragOverIndex}
                  onDrop={handleDrop}
                  onDragOver={setDragOverIndex}
                  onSelect={handleSelectField}
                  onMove={handleFieldMove}
                  onDuplicate={handleFieldDuplicate}
                  onDelete={handleFieldDelete}
                />
              </CardBody>
            </Card>
          </div>

          {/* Right: Field Properties */}
          <div className="col-md-3">
            <Card>
              <CardBody>
                <h6 className="mb-3">Proprietà</h6>
                {selectedField ? (
                  <FieldEditor field={selectedField} onUpdate={handleFieldUpdate} />
                ) : (
                  <p className="text-muted small">
                    Seleziona un campo per modificarne le proprietà
                  </p>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {view === 'preview' && (
        <Card>
          <CardBody>
            <h6 className="mb-3">Anteprima Form</h6>
            {fields.length === 0 ? (
              <Alert variant="info">
                Aggiungi dei campi al form per vedere l&apos;anteprima
              </Alert>
            ) : (
              <FormPreview fields={fields} />
            )}
          </CardBody>
        </Card>
      )}

      {view === 'json' && (
        <Card>
          <CardBody>
            <h6 className="mb-3">Schema JSON</h6>
            <pre
              className="bg-light p-3 rounded"
              style={{ maxHeight: '500px', overflow: 'auto', fontSize: '12px' }}
            >
              {JSON.stringify({ fields, version: '1.0' }, null, 2)}
            </pre>
          </CardBody>
        </Card>
      )}

      <style jsx>{`
        .form-builder {
          min-height: 600px;
        }
      `}</style>
    </div>
  );
}
