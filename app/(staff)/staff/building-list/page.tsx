"use client";
import React, { useState } from "react";
import { Button } from "@/components/common";
import type { Building } from "@/hooks/reactquery/buildings";
import { BuildingTable } from "./components/BuildingTable";
import { BuildingFormModal } from "./components/BuildingFormModal";
import { BuildingDetailPanel } from "./components/BuildingDetailPanel";
import { UnitList } from "./components/UnitList";

export default function BuildingListPage() {
  const [search, setSearch] = useState("");
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);

  const openCreate = () => {
    setEditingBuilding(null);
    setModalOpen(true);
  };

  const openEdit = () => {
    setEditingBuilding(selectedBuilding);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingBuilding(null);
  };

  return (
    <div className="flex h-full min-h-screen flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-t1">건물 관리</h1>
        <Button variant="primary" onClick={openCreate}>
          + 건물 등록
        </Button>
      </div>

      <div className="flex flex-1 gap-6">
        {/* Left: Building list */}
        <div className="w-full max-w-xl flex-shrink-0">
          <BuildingTable
            search={search}
            onSearchChange={setSearch}
            selectedId={selectedBuilding?.id ?? null}
            onSelect={setSelectedBuilding}
          />
        </div>

        {/* Right: Detail panel + Unit list */}
        {selectedBuilding && (
          <div className="flex flex-1 flex-col gap-4">
            <BuildingDetailPanel building={selectedBuilding} onEdit={openEdit} />
            <UnitList buildingId={selectedBuilding.id} />
          </div>
        )}
      </div>

      <BuildingFormModal
        open={modalOpen}
        onClose={closeModal}
        editing={editingBuilding}
        onSaved={(b) => setSelectedBuilding(b)}
      />
    </div>
  );
}
