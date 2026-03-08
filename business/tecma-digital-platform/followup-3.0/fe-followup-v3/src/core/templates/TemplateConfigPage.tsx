import { useMemo, useState } from "react";
import { followupApi } from "../../api/followupApi";
import type { ConfigurationTemplateSchema } from "../../types/domain";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { INPUT_LIKE_CLASSES, TEXTAREA_LIKE_CLASSES } from "../../lib/ds-form-classes";
import { cn } from "../../lib/utils";

interface TemplateConfigPageProps {
  workspaceId: string;
  projectIds: string[];
}

const defaultTemplate = (): ConfigurationTemplateSchema => ({
  sections: [
    {
      id: "living",
      title: "Living",
      fields: [
        { key: "kitchen", label: "Kitchen", type: "number", required: true },
        { key: "lighting", label: "Lighting", type: "number" }
      ]
    }
  ]
});

export const TemplateConfigPage = ({ workspaceId, projectIds }: TemplateConfigPageProps) => {
  const [projectId, setProjectId] = useState(projectIds[0] ?? "");
  const [template, setTemplate] = useState<ConfigurationTemplateSchema>(defaultTemplate());
  const [raw, setRaw] = useState(JSON.stringify(defaultTemplate(), null, 2));
  const [jsonMode, setJsonMode] = useState(false);
  const [validationResult, setValidationResult] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);

  const sectionsCount = template.sections.length;
  const fieldsCount = useMemo(() => template.sections.reduce((acc, section) => acc + section.fields.length, 0), [template]);

  const syncRaw = (next: ConfigurationTemplateSchema) => {
    setTemplate(next);
    setRaw(JSON.stringify(next, null, 2));
  };

  const load = async () => {
    setMessage(null);
    try {
      const result = await followupApi.getTemplateConfiguration(projectId);
      syncRaw(result.template);
      setMessage("Template caricato");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Template non trovato");
    }
  };

  const addSection = () => {
    const id = `section_${Date.now()}`;
    syncRaw({
      ...template,
      sections: [...template.sections, { id, title: "Nuova sezione", fields: [] }]
    });
  };

  const addField = (sectionId: string) => {
    syncRaw({
      ...template,
      sections: template.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              fields: [
                ...section.fields,
                { key: `field_${Date.now()}`, label: "Nuovo campo", type: "text" }
              ]
            }
          : section
      )
    });
  };

  const validate = async () => {
    try {
      const candidate = jsonMode ? (JSON.parse(raw) as ConfigurationTemplateSchema) : template;
      const response = await followupApi.validateTemplateConfiguration(projectId, candidate);
      setValidationResult(JSON.stringify(response, null, 2));
      if (response.valid && jsonMode) {
        syncRaw(candidate);
      }
    } catch (error) {
      setValidationResult(
        JSON.stringify(
          {
            valid: false,
            errors: [error instanceof Error ? error.message : "JSON non valido"]
          },
          null,
          2
        )
      );
    }
  };

  const save = async () => {
    setMessage(null);
    try {
      const candidate = jsonMode ? (JSON.parse(raw) as ConfigurationTemplateSchema) : template;
      await followupApi.saveTemplateConfiguration(projectId, workspaceId, candidate);
      setMessage("Template salvato");
      if (jsonMode) {
        syncRaw(candidate);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Errore salvataggio");
    }
  };

  return (
    <section className="hc-shell">
      <div className="hc-card">
        <div className="hc-head">
          <h3>Template Config</h3>
          <p>Editor sezione/campi con modalita visuale o JSON, validate e save per progetto.</p>
        </div>

        <div className="project-access-form">
          <select className={cn(INPUT_LIKE_CLASSES)} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projectIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
          <Button variant="outline" type="button" onClick={load}>
            Load
          </Button>
          <Button variant="outline" type="button" onClick={() => setJsonMode((v) => !v)}>
            {jsonMode ? "Visual mode" : "JSON mode"}
          </Button>
        </div>

        <div className="hc-summary-grid">
          <div>
            <strong>Sezioni:</strong> {sectionsCount}
          </div>
          <div>
            <strong>Campi:</strong> {fieldsCount}
          </div>
          <div>
            <strong>Modalita:</strong> {jsonMode ? "JSON" : "Visual"}
          </div>
        </div>

        {!jsonMode && (
          <div className="hc-grid">
            {template.sections.map((section, index) => (
              <div key={section.id} className="hc-section-box">
                <label>
                  Titolo sezione
                  <input
                    className={cn(INPUT_LIKE_CLASSES)}
                    value={section.title}
                    onChange={(e) => {
                      const next = { ...template };
                      next.sections[index] = { ...section, title: e.target.value };
                      syncRaw(next);
                    }}
                  />
                </label>
                <label>
                  ID sezione
                  <input
                    className={cn(INPUT_LIKE_CLASSES)}
                    value={section.id}
                    onChange={(e) => {
                      const next = { ...template };
                      next.sections[index] = { ...section, id: e.target.value };
                      syncRaw(next);
                    }}
                  />
                </label>

                {section.fields.map((field, fieldIndex) => (
                  <div className="hc-inline-grid" key={field.key}>
                    <input
                      className={cn(INPUT_LIKE_CLASSES)}
                      value={field.key}
                      onChange={(e) => {
                        const next = { ...template };
                        next.sections[index].fields[fieldIndex] = { ...field, key: e.target.value };
                        syncRaw(next);
                      }}
                    />
                    <input
                      className={cn(INPUT_LIKE_CLASSES)}
                      value={field.label}
                      onChange={(e) => {
                        const next = { ...template };
                        next.sections[index].fields[fieldIndex] = { ...field, label: e.target.value };
                        syncRaw(next);
                      }}
                    />
                    <select
                      className={cn(INPUT_LIKE_CLASSES)}
                      value={field.type}
                      onChange={(e) => {
                        const next = { ...template };
                        next.sections[index].fields[fieldIndex] = {
                          ...field,
                          type: e.target.value as "number" | "text" | "select" | "multiselect"
                        };
                        syncRaw(next);
                      }}
                    >
                      <option value="number">number</option>
                      <option value="text">text</option>
                      <option value="select">select</option>
                      <option value="multiselect">multiselect</option>
                    </select>
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => {
                        const next = { ...template };
                        next.sections[index].fields = next.sections[index].fields.filter((_, idx) => idx !== fieldIndex);
                        syncRaw(next);
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))}

                <div className="project-access-form">
                  <Button variant="outline" type="button" onClick={() => addField(section.id)}>
                    Add field
                  </Button>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() =>
                      syncRaw({
                        ...template,
                        sections: template.sections.filter((s) => s.id !== section.id)
                      })
                    }
                  >
                    Remove section
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" type="button" onClick={addSection}>
              Add section
            </Button>
          </div>
        )}

        {jsonMode && <textarea className={cn(TEXTAREA_LIKE_CLASSES)} rows={22} value={raw} onChange={(e) => setRaw(e.target.value)} />}

        <div className="hc-actions">
          <Button variant="outline" type="button" onClick={validate}>
            Validate
          </Button>
          <Button type="button" onClick={save}>
            Save
          </Button>
        </div>

        {validationResult && (
          <div className="hc-preview-box">
            <h4>Validation result</h4>
            <pre>{validationResult}</pre>
          </div>
        )}

        {message && <p className="generic-table-feedback">{message}</p>}
      </div>
    </section>
  );
};
