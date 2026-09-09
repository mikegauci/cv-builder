"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { SkillPoolItem, SkillProficiency } from "@/lib/types";

interface Props {
  initialSkills: SkillPoolItem[];
}

const proficiencyOptions: SkillProficiency[] = ["expert", "proficient", "familiar"];

function parseBulkPaste(text: string): Array<{ category: string; name: string }> {
  const results: Array<{ category: string; name: string }> = [];

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;

    const category = trimmed.slice(0, colonIndex).trim();
    const skillsPart = trimmed.slice(colonIndex + 1).trim();
    if (!category || !skillsPart) continue;

    for (const skill of skillsPart.split(",")) {
      const name = skill.trim();
      if (name) {
        results.push({ category, name });
      }
    }
  }

  return results;
}

export default function SkillPoolManager({ initialSkills }: Props) {
  const [skills, setSkills] = useState(initialSkills);
  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [proficiency, setProficiency] = useState<SkillProficiency>("proficient");
  const [context, setContext] = useState("");
  const [bulkPaste, setBulkPaste] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function addSkill(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!category.trim() || !name.trim()) {
      setMessage("Category and skill name are required.");
      return;
    }

    setLoading(true);
    const nextOrder =
      skills.filter((skill) => skill.category === category.trim()).length + 1;

    const { data, error } = await supabase
      .from("skill_pool")
      .insert({
        category: category.trim(),
        name: name.trim(),
        proficiency,
        context: context.trim() || null,
        item_order: nextOrder,
      })
      .select("*")
      .single();

    if (error || !data) {
      setMessage(error?.message ?? "Could not add skill.");
      setLoading(false);
      return;
    }

    setSkills((prev) => [...prev, data as SkillPoolItem].sort(sortSkills));
    setName("");
    setContext("");
    setLoading(false);
  }

  async function importFromCvs() {
    setMessage("");
    setLoading(true);

    const { data: entries, error: entriesError } = await supabase
      .from("cv_entries")
      .select("title, description")
      .eq("section", "skills");

    if (entriesError) {
      setMessage(entriesError.message);
      setLoading(false);
      return;
    }

    const existingKeys = new Set(
      skills.map((skill) => `${skill.category.toLowerCase()}::${skill.name.toLowerCase()}`)
    );
    const toInsert: Array<{
      category: string;
      name: string;
      proficiency: SkillProficiency;
      item_order: number;
    }> = [];

    const orderByCategory = new Map<string, number>();

    for (const entry of entries ?? []) {
      const categoryName = (entry.title as string)?.trim();
      const description = (entry.description as string)?.trim();
      if (!categoryName || !description) continue;

      for (const skillName of description.split(",")) {
        const trimmed = skillName.trim();
        if (!trimmed) continue;

        const key = `${categoryName.toLowerCase()}::${trimmed.toLowerCase()}`;
        if (existingKeys.has(key)) continue;

        existingKeys.add(key);
        const nextOrder = (orderByCategory.get(categoryName) ?? 0) + 1;
        orderByCategory.set(categoryName, nextOrder);
        toInsert.push({
          category: categoryName,
          name: trimmed,
          proficiency: "proficient",
          item_order: nextOrder,
        });
      }
    }

    if (toInsert.length === 0) {
      setMessage("No new skills to import from your CVs.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.from("skill_pool").insert(toInsert).select("*");
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setSkills((prev) => [...prev, ...(data as SkillPoolItem[])].sort(sortSkills));
    setMessage(`Imported ${data.length} skill(s) from your CVs.`);
    setLoading(false);
  }

  async function importBulkPaste() {
    setMessage("");
    const parsed = parseBulkPaste(bulkPaste);
    if (parsed.length === 0) {
      setMessage('Paste one category per line, e.g. "Real-time: WebSockets, Redis".');
      return;
    }

    setLoading(true);
    const existingKeys = new Set(
      skills.map((skill) => `${skill.category.toLowerCase()}::${skill.name.toLowerCase()}`)
    );
    const orderByCategory = new Map<string, number>(
      skills.map((skill) => [skill.category, skill.item_order])
    );
    const toInsert: Array<{
      category: string;
      name: string;
      proficiency: SkillProficiency;
      item_order: number;
    }> = [];

    for (const item of parsed) {
      const key = `${item.category.toLowerCase()}::${item.name.toLowerCase()}`;
      if (existingKeys.has(key)) continue;

      existingKeys.add(key);
      const nextOrder = (orderByCategory.get(item.category) ?? 0) + 1;
      orderByCategory.set(item.category, nextOrder);
      toInsert.push({
        category: item.category,
        name: item.name,
        proficiency: "proficient",
        item_order: nextOrder,
      });
    }

    if (toInsert.length === 0) {
      setMessage("All pasted skills are already in the pool.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.from("skill_pool").insert(toInsert).select("*");
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setSkills((prev) => [...prev, ...(data as SkillPoolItem[])].sort(sortSkills));
    setBulkPaste("");
    setMessage(`Added ${data.length} skill(s) from bulk paste.`);
    setLoading(false);
  }

  async function updateSkill(skill: SkillPoolItem) {
    setMessage("");
    const { data, error } = await supabase
      .from("skill_pool")
      .update({
        category: skill.category.trim(),
        name: skill.name.trim(),
        proficiency: skill.proficiency,
        context: skill.context?.trim() || null,
        item_order: skill.item_order,
      })
      .eq("id", skill.id)
      .select("*")
      .single();

    if (error || !data) {
      setMessage(error?.message ?? "Could not update skill.");
      return;
    }

    setSkills((prev) =>
      prev.map((item) => (item.id === skill.id ? (data as SkillPoolItem) : item)).sort(sortSkills)
    );
  }

  async function deleteSkill(id: number) {
    const confirmed = window.confirm("Delete this skill from the pool?");
    if (!confirmed) return;

    const { error } = await supabase.from("skill_pool").delete().eq("id", id);
    if (error) {
      setMessage(error.message);
      return;
    }

    setSkills((prev) => prev.filter((skill) => skill.id !== id));
  }

  function patchSkill(id: number, patch: Partial<SkillPoolItem>) {
    setSkills((prev) =>
      prev.map((skill) => (skill.id === id ? { ...skill, ...patch } : skill))
    );
  }

  const grouped = skills.reduce<Record<string, SkillPoolItem[]>>((acc, skill) => {
    acc[skill.category] = acc[skill.category] ?? [];
    acc[skill.category].push(skill);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <form onSubmit={addSkill} className="bg-white border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-[#1a2744]">Add Skill</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border border-gray-300 px-3 py-2 text-sm"
            placeholder="Category (e.g. Real-time Communication)"
            required
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-gray-300 px-3 py-2 text-sm"
            placeholder="Skill name (e.g. WebSockets)"
            required
          />
          <select
            value={proficiency}
            onChange={(e) => setProficiency(e.target.value as SkillProficiency)}
            className="border border-gray-300 px-3 py-2 text-sm"
          >
            {proficiencyOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <input
            value={context}
            onChange={(e) => setContext(e.target.value)}
            className="border border-gray-300 px-3 py-2 text-sm"
            placeholder="Context (optional, e.g. used at Winnables)"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-[#1a2744] text-white px-5 py-2 text-sm hover:bg-[#243256] disabled:opacity-50"
        >
          {loading ? "Saving..." : "Add Skill"}
        </button>
      </form>

      <div className="bg-white border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-[#1a2744]">Import Skills</h2>
        <p className="text-xs text-gray-500">
          Seed your pool from existing CV skill sections, or bulk paste one category per line.
        </p>
        <button
          type="button"
          onClick={() => void importFromCvs()}
          disabled={loading}
          className="text-sm border border-gray-300 px-4 py-2 hover:bg-gray-50 disabled:opacity-50"
        >
          Import from my CVs
        </button>
        <textarea
          value={bulkPaste}
          onChange={(e) => setBulkPaste(e.target.value)}
          className="w-full border border-gray-300 px-3 py-2 text-sm min-h-24"
          placeholder={"Real-time & Messaging: WebSockets, Socket.IO, Redis Pub/Sub\nInfrastructure: Docker, Kubernetes, AWS"}
        />
        <button
          type="button"
          onClick={() => void importBulkPaste()}
          disabled={loading}
          className="bg-[#1a2744] text-white px-5 py-2 text-sm hover:bg-[#243256] disabled:opacity-50"
        >
          Import bulk paste
        </button>
      </div>

      <div className="bg-white border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-[#1a2744]">Skills Pool ({skills.length})</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {skills.length === 0 && (
            <p className="px-6 py-6 text-sm text-gray-500">
              No skills in the pool yet. Import from your CVs or add skills manually.
            </p>
          )}
          {Object.entries(grouped).map(([groupCategory, groupSkills]) => (
            <div key={groupCategory} className="px-6 py-4 space-y-3">
              <p className="text-sm font-medium text-[#1a2744]">{groupCategory}</p>
              {groupSkills.map((skill) => (
                <div key={skill.id} className="grid md:grid-cols-5 gap-2 items-start border border-gray-100 p-3">
                  <input
                    value={skill.name}
                    onChange={(e) => patchSkill(skill.id, { name: e.target.value })}
                    className="border border-gray-300 px-2 py-1.5 text-sm md:col-span-1"
                  />
                  <select
                    value={skill.proficiency}
                    onChange={(e) =>
                      patchSkill(skill.id, { proficiency: e.target.value as SkillProficiency })
                    }
                    className="border border-gray-300 px-2 py-1.5 text-sm md:col-span-1"
                  >
                    {proficiencyOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <input
                    value={skill.context ?? ""}
                    onChange={(e) => patchSkill(skill.id, { context: e.target.value })}
                    className="border border-gray-300 px-2 py-1.5 text-sm md:col-span-2"
                    placeholder="Context"
                  />
                  <div className="flex gap-2 md:col-span-1">
                    <button
                      type="button"
                      onClick={() => void updateSkill(skill)}
                      className="text-xs border border-gray-300 px-2 py-1.5 hover:bg-gray-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteSkill(skill.id)}
                      className="text-xs text-red-500 border border-red-200 px-2 py-1.5 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {message && <p className="text-xs text-gray-600">{message}</p>}
    </div>
  );
}

function sortSkills(a: SkillPoolItem, b: SkillPoolItem): number {
  if (a.category === b.category) {
    return a.item_order - b.item_order;
  }
  return a.category.localeCompare(b.category);
}
