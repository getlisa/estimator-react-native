import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, TextInput, View } from 'react-native';

import { Actions, Empty, Hint, RecordCard, Row, useAction } from '@/components/admin/common';
import { PdfPreview } from '@/components/admin/PdfPreview';
import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Input } from '@/components/ui';
import { CheckRow, Select } from '@/components/ui/Select';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { MIME, pickDocument } from '@/lib/pickFile';
import { confirm, errMsg, toast } from '@/lib/ui';
import { adminService, type AdminProposalTemplate, type ProposalBlock, type ProposalDynamicType, type ProposalStaticPart } from '@/services/adminService';

const DYNAMIC_LABELS: Record<ProposalDynamicType, string> = {
  logo: 'Company logo', contactLine: 'Contact line (phone | email)', projectBlock: 'Project / customer / date lines',
  scopeOfWork: 'Scope of work (from the quote)', lineItems: 'Line-item table (rates, quantities, totals)',
  costSummary: 'Prices and totals (prose)', preparedBy: 'Prepared by', photos: 'Job photos',
};
const DYNAMIC_TYPES = Object.keys(DYNAMIC_LABELS) as ProposalDynamicType[];
const FONTS = ['Helvetica', 'Arial', 'Times New Roman', 'Courier'];

/** Template library: named proposal designs, one default (AdminConfig.tsx ProposalTab). */
export function ProposalTab({ companyId }: { companyId: number }) {
  const { colors } = useTheme();
  const [templates, setTemplates] = useState<AdminProposalTemplate[]>([]);
  const [selected, setSelected] = useState<AdminProposalTemplate | null>(null);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const { busy, run } = useAction();

  const load = useCallback(async () => {
    setLoading(true);
    try { setTemplates((await adminService.listProposalTemplates(companyId)).templates); }
    catch (e) { toast.error(errMsg(e, 'Could not load the proposal templates')); }
    finally { setLoading(false); }
  }, [companyId]);
  useEffect(() => { void load(); }, [load]);

  if (loading) return <ActivityIndicator color={colors.tint} />;
  if (selected) return <ProposalTemplateEditor companyId={companyId} template={selected} onBack={() => { setSelected(null); void load(); }} />;

  return (
    <>
      <Hint>A company keeps a library of named proposal designs. The default applies when the technician didn't pick one in chat; with two or more templates the chat asks which to use, once per estimate. The chosen design drives both the emailed PDF and the .docx download.</Hint>
      <Actions>
        <Button size="sm" variant="secondary" icon="cloud-upload-outline" disabled={busy} onPress={() => run(async () => {
          const file = await pickDocument(MIME.html); if (!file) return;
          const { template, removed } = await adminService.ingestHtmlProposalTemplate(companyId, file);
          await load();
          toast.success(`"${template.name}" added as an HTML document — ${removed.length ? `Removed for safety: ${removed.join(', ')}. Preview it before using it.` : 'Preview it to see it filled with sample data.'}`);
        })}>Upload HTML document</Button>
        <ThemedText type="caption" style={{ flex: 1 }}>An .html page with {'{{tokens}}'} — scripts and embedded frames are stripped on upload.</ThemedText>
      </Actions>
      {templates.length === 0 && <Empty>This company is on the built-in standard proposal. Create a template to customise it — the first one becomes the default automatically.</Empty>}
      {templates.map((t) => (
        <RecordCard key={t.id}>
          <Actions>
            <ThemedText type="defaultSemiBold">{t.name}</ThemedText>
            {t.isDefault && <Badge size="sm">Default</Badge>}
            {(t.htmlFile || t.html) && <Badge size="sm" variant="info">{t.htmlFile ? 'HTML (code)' : 'HTML'}</Badge>}
            <ThemedText type="caption">Updated {new Date(t.updatedAt).toLocaleDateString()}</ThemedText>
          </Actions>
          <Actions>
            {t.htmlFile || t.html ? (
              <Button size="sm" variant="secondary" icon="eye-outline" onPress={() => Linking.openURL(adminService.htmlProposalPreviewUrl(companyId))}>Preview</Button>
            ) : (
              <Button size="sm" variant="secondary" disabled={busy} onPress={() => setSelected(t)}>Edit</Button>
            )}
            {!t.isDefault && <Button size="sm" variant="ghost" disabled={busy} onPress={() => run(async () => { await adminService.setDefaultProposalTemplate(t.id); await load(); toast.success(`"${t.name}" is now the default`); })}>Set default</Button>}
            <Button size="sm" variant="ghost" icon="trash-outline" disabled={busy} onPress={() => run(async () => {
              if (!(await confirm(`Delete "${t.name}"? Estimates that used it fall back to the default design.`))) return;
              await adminService.deleteProposalTemplate(t.id); await load(); toast.success('Template deleted');
            })}>Delete</Button>
          </Actions>
        </RecordCard>
      ))}
      <Row>
        <Input containerStyle={{ flex: 1, minWidth: 160 }} value={newName} onChangeText={setNewName} placeholder="New template name…" />
        <Button size="sm" icon="add" disabled={busy || !newName.trim()} onPress={() => run(async () => {
          const created = await adminService.createProposalTemplate(companyId, newName.trim());
          setNewName(''); await load(); setSelected(created); toast.success('Template created — customise it below');
        })}>New template</Button>
      </Row>
    </>
  );
}

/** Block editor scoped to one template; Save writes name + blocks (AdminConfig.tsx:1202). */
function ProposalTemplateEditor({ companyId, template, onBack }: { companyId: number; template: AdminProposalTemplate; onBack: () => void }) {
  const { colors } = useTheme();
  const [name, setName] = useState(template.name);
  const [blocks, setBlocks] = useState<ProposalBlock[]>(template.blocks);
  const [dirty, setDirty] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewNote, setPreviewNote] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const previewSeq = useRef(0);
  const { busy, run } = useAction();

  const accent = blocks.find((b) => b.style?.color)?.style?.color ?? '';
  const setAccent = (raw: string) => {
    const hex = raw.replace('#', '').trim();
    setBlocks((prev) => prev.map((b, i) => i === 0 ? { ...b, style: { ...b.style, ...(hex ? { color: hex } : {}) } } : hex ? b : { ...b, style: b.style ? { ...b.style, color: undefined } : b.style }));
    setDirty(true);
  };
  const edit = (index: number, patch: Partial<ProposalBlock>) => { setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b))); setDirty(true); };
  const move = (index: number, delta: number) => {
    const to = index + delta; if (to < 0 || to >= blocks.length) return;
    setBlocks((prev) => { const next = [...prev]; [next[index], next[to]] = [next[to], next[index]]; return next; }); setDirty(true);
  };
  const remove = (index: number) => { setBlocks((prev) => prev.filter((_, i) => i !== index)); setDirty(true); };
  const addStatic = () => { setBlocks((prev) => [...prev, { id: `section-${Date.now()}`, heading: 'NEW SECTION', visible: true, content: [{ format: 'paragraph', text: '' }] }]); setDirty(true); };
  const addDynamic = (type: ProposalDynamicType) => { setBlocks((prev) => [...prev, { id: `${type}-${Date.now()}`, visible: true, dynamic: type }]); setDirty(true); };

  // Live preview: any edit re-renders after 700 ms; invalid mid-edit states keep the last good render.
  useEffect(() => {
    if (!previewing) return;
    const seq = ++previewSeq.current;
    setPreviewBusy(true);
    const timer = setTimeout(async () => {
      try {
        const renderable = blocks.map((b) => {
          if (b.dynamic) return b;
          const content = (b.content ?? [])
            .map((part) => (part.format === 'paragraph' ? part : { ...part, items: (part.items ?? []).filter((it) => it.trim()) }))
            .filter((part) => (part.format === 'paragraph' ? !!(part.text?.trim() || part.label?.trim()) : (part.items ?? []).length > 0));
          return content.length > 0 ? { ...b, content } : null;
        }).filter((b): b is ProposalBlock => b !== null);
        if (renderable.length === 0) return;
        const blob = await adminService.previewProposalTemplate(companyId, renderable);
        if (seq !== previewSeq.current) return;
        setPreviewBlob(blob); setPreviewNote(null);
      } catch (e) {
        if (seq === previewSeq.current) setPreviewNote(errMsg(e, 'Preview could not be updated'));
      } finally { if (seq === previewSeq.current) setPreviewBusy(false); }
    }, 700);
    return () => clearTimeout(timer);
  }, [previewing, blocks, companyId]);

  const save = () => run(async () => {
    const trimmed = name.trim(); if (!trimmed) return toast.error('The template needs a name');
    const updated = await adminService.updateProposalTemplate(template.id, { name: trimmed, blocks });
    setBlocks(updated.blocks); setName(updated.name); setDirty(false);
    toast.success('Template saved — estimates using it will render the new design');
  });
  const upload = () => run(async () => {
    const file = await pickDocument(MIME.docxOrPdf); if (!file) return;
    const result = await adminService.importProposalTemplate(companyId, file);
    setBlocks(result.blocks); setWarnings(result.warnings); setDirty(true);
    toast.success('Document read — review the sections below, then Save');
  });

  return (
    <>
      <Actions>
        <Button size="sm" variant="ghost" icon="arrow-back" onPress={async () => { if (dirty && !(await confirm('Discard unsaved changes to this template?'))) return; onBack(); }}>Templates</Button>
        <Input containerStyle={{ flex: 1, minWidth: 160 }} value={name} onChangeText={(v) => { setName(v); setDirty(true); }} placeholder="Template name" />
        {template.isDefault && <Badge size="sm">Default</Badge>}
        {dirty && <Badge size="sm" variant="warning">Unsaved changes</Badge>}
      </Actions>
      <Row>
        <Input label="Accent (hex)" containerStyle={{ width: 140 }} value={accent} onChangeText={setAccent} placeholder="222222" autoCapitalize="none" />
        <View style={{ width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: /^[0-9a-f]{6}$/i.test(accent) ? `#${accent}` : '#222222' }} />
        <Button size="sm" variant="secondary" icon="cloud-upload-outline" disabled={busy} onPress={upload}>Upload their proposal</Button>
        <Button size="sm" variant={previewing ? 'primary' : 'secondary'} icon="eye-outline" onPress={() => setPreviewing((p) => !p)}>{previewing ? 'Hide preview' : 'Preview'}</Button>
        <Button size="sm" loading={busy} disabled={!dirty} onPress={save}>Save</Button>
      </Row>
      <Hint>Upload the company's own .docx or .pdf proposal and its sections are read automatically — their wording and formatting are kept, and the parts that change per quote (prices, scope, customer) become dynamic blocks. Review below, preview, then save. The saved format is used for both the emailed PDF and the .docx download.</Hint>
      {warnings.map((w) => <RecordCard key={w}><ThemedText type="caption" style={{ color: colors.warning }}>{w}</ThemedText></RecordCard>)}
      {previewing && (
        <RecordCard>
          <Actions>
            <ThemedText type="label">Preview (sample data) — updates as you edit</ThemedText>
            {previewBusy && <ActivityIndicator size="small" color={colors.textSecondary} />}
            {previewNote && <ThemedText type="caption">showing the last valid version — {previewNote}</ThemedText>}
          </Actions>
          {previewBlob ? <PdfPreview blob={previewBlob} filename={`${name || 'proposal'}-preview.pdf`} /> : <ThemedText type="caption">Rendering…</ThemedText>}
        </RecordCard>
      )}
      {blocks.map((block, i) => (
        <BlockEditor key={block.id} block={block} index={i} total={blocks.length} busy={busy} onEdit={(p) => edit(i, p)} onMove={(d) => move(i, d)} onRemove={() => remove(i)} />
      ))}
      <Row>
        <Button size="sm" variant="secondary" icon="add" disabled={busy} onPress={addStatic}>Add a section of their own text</Button>
        <View style={{ flex: 1, minWidth: 200 }}>
          <Select value={null} placeholder="Add a dynamic section…" options={DYNAMIC_TYPES.map((t) => ({ value: t, label: DYNAMIC_LABELS[t] }))} onChange={addDynamic} compact />
        </View>
      </Row>
    </>
  );
}

function BlockEditor({ block, index, total, busy, onEdit, onMove, onRemove }: {
  block: ProposalBlock; index: number; total: number; busy: boolean; onEdit: (p: Partial<ProposalBlock>) => void; onMove: (d: number) => void; onRemove: () => void;
}) {
  const { colors } = useTheme();
  const style = block.style ?? {};
  const setStyle = (patch: Partial<NonNullable<ProposalBlock['style']>>) => onEdit({ style: { ...style, ...patch } });
  const setPart = (pi: number, patch: Partial<ProposalStaticPart>) => onEdit({ content: (block.content ?? []).map((p, i) => (i === pi ? { ...p, ...patch } : p)) });
  const area = { minHeight: 80, borderWidth: 1, borderRadius: 10, padding: Spacing.md, color: colors.inputText, backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, textAlignVertical: 'top' as const };

  return (
    <RecordCard dim={!block.visible}>
      <Row>
        <View style={{ flex: 1, minWidth: 180 }}>
          <Select compact value={block.dynamic ?? 'static'}
            options={[{ value: 'static', label: 'Their text (static)' }, ...DYNAMIC_TYPES.map((t) => ({ value: t, label: `Dynamic: ${DYNAMIC_LABELS[t]}` }))]}
            onChange={(v) => v === 'static'
              ? onEdit({ dynamic: undefined, content: block.content?.length ? block.content : [{ format: 'paragraph', text: '' }] })
              : onEdit({ dynamic: v as ProposalDynamicType, ...(block.heading === 'NEW SECTION' ? { heading: undefined } : {}) })} />
        </View>
        <Input containerStyle={{ flex: 1, minWidth: 160 }} placeholder="Section heading (optional)" value={block.heading ?? ''} onChangeText={(v) => onEdit({ heading: v || undefined })} />
      </Row>
      <Actions>
        <CheckRow label={block.visible ? 'Shown' : 'Hidden'} checked={block.visible} disabled={busy} onChange={(v) => onEdit({ visible: v })} />
        <View style={{ flex: 1 }} />
        <Button size="sm" variant="ghost" icon="arrow-up" disabled={busy || index === 0} onPress={() => onMove(-1)}>Up</Button>
        <Button size="sm" variant="ghost" icon="arrow-down" disabled={busy || index === total - 1} onPress={() => onMove(1)}>Down</Button>
        <Button size="sm" variant="ghost" icon="trash-outline" disabled={busy} onPress={onRemove}>Remove</Button>
      </Actions>
      {block.dynamic === 'logo' && (
        <Row>
          <Input label="Logo size (pt, 24–240)" containerStyle={{ width: 160 }} keyboardType="numeric" value={String(block.logoSize ?? 90)} onChangeText={(v) => onEdit({ logoSize: v ? Number(v) : undefined })} />
        </Row>
      )}
      {block.dynamic ? (
        <Hint>Filled from each quote. It can be moved, hidden or restyled, but its contents are generated — so pricing and scope always match the quote.</Hint>
      ) : (
        (block.content ?? []).map((part, pi) => (
          <View key={pi} style={{ gap: Spacing.sm }}>
            <Row>
              <View style={{ width: 170 }}>
                <Select compact value={part.format} options={[{ value: 'paragraph', label: 'Paragraph' }, { value: 'bullets', label: 'Bulleted list' }, { value: 'numbered', label: 'Numbered list' }]}
                  onChange={(v) => setPart(pi, { format: v as ProposalStaticPart['format'], ...(v === 'paragraph' ? { text: part.text ?? (part.items ?? []).join(' '), items: undefined } : { items: part.items ?? (part.text ? [part.text] : ['']), text: undefined }) })} />
              </View>
              <Input containerStyle={{ flex: 1, minWidth: 140 }} placeholder="Bold label (optional)" value={part.label ?? ''} onChangeText={(v) => setPart(pi, { label: v || undefined })} />
            </Row>
            {part.format === 'paragraph' ? (
              <TextInput multiline style={area} value={part.text ?? ''} placeholderTextColor={colors.inputPlaceholder} onChangeText={(v) => setPart(pi, { text: v })}
                placeholder="Their wording. {{companyName}}, {{companyAddress}}, {{technicianName}}, {{licenseNumber}}, {{companyPhone}} and {{companyEmail}} are filled in." />
            ) : (
              <TextInput multiline style={area} value={(part.items ?? []).join('\n')} placeholder="One item per line" placeholderTextColor={colors.inputPlaceholder} onChangeText={(v) => setPart(pi, { items: v.split('\n') })} />
            )}
          </View>
        ))
      )}
      <Row>
        <View style={{ width: 110 }}><Select compact value={style.align ?? 'left'} options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }]} onChange={(v) => setStyle({ align: v as 'left' })} /></View>
        <View style={{ width: 170 }}><Select compact value={style.fontFamily ?? 'Helvetica'} options={FONTS.map((f) => ({ value: f, label: f }))} onChange={(v) => setStyle({ fontFamily: v })} /></View>
        <Input containerStyle={{ width: 80 }} placeholder="pt" keyboardType="numeric" value={style.fontSize != null ? String(style.fontSize) : ''} onChangeText={(v) => setStyle({ fontSize: v ? Number(v) : undefined })} />
        <CheckRow label="Bold" checked={style.bold === true} onChange={(v) => setStyle({ bold: v || undefined })} />
        <CheckRow label="Italic" checked={style.italic === true} onChange={(v) => setStyle({ italic: v || undefined })} />
      </Row>
    </RecordCard>
  );
}
