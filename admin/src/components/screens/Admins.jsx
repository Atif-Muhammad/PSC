import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldPlus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdmins, createAdmin, updateAdmin, deleteAdmin } from "../../../config/apis";
import AdminCard from "../cards/AdminCard";
import AdminModal from "../modals/AdminModal";
import ConfirmModal from "../ui/modals/ConfirmModal";

function Admins({ id }) {
  const queryClient = useQueryClient();

  const { data: admins = [], isLoading } = useQuery({
    queryKey: ["admins", id],
    queryFn: getAdmins,
    enabled: !!id,
  });

  const [showModal, setShowModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [error, setError] = useState("");
  const [confirmData, setConfirmData] = useState(null); 

  const createMutation = useMutation({
    mutationFn: createAdmin,
    onSuccess: async () => {
      await queryClient.invalidateQueries(["admins"]);
      setShowModal(false);
    },
    onError: (err) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: updateAdmin,
    onSuccess: async () => {
      await queryClient.invalidateQueries(["admins"]);
      setShowModal(false);
    },
    onError: (err) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdmin,
    onSuccess: () => {
      queryClient.invalidateQueries(["admins"]);
      setConfirmData(null);
    },
    onError: (err) => setError(err.message),
  });

  const handleSubmit = (adminData, isNew) => {
    if (isNew) createMutation.mutate(adminData);
    else updateMutation.mutate(adminData);
  };

  const handleDelete = (admin) => {
    // instead of window.confirm
    setConfirmData({
      title: "Delete Admin",
      message: `Are you sure you want to delete "${admin.name}" (${admin.email})?`,
      onConfirm: () => deleteMutation.mutate(admin.id),
    });
  };

  const handleOpenModal = (admin = null) => {
    setEditingAdmin(admin);
    setError("");
    setShowModal(true);
  };

  return (
    <div className="min-h-screen font-sans">
      {/* Header */}
      <div className="flex justify-end items-center mb-10 border-b border-amber-400/50 pb-4">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => handleOpenModal()}
          className="flex items-center gap-x-1 px-4 py-2 bg-amber-400 text-gray-950 font-bold rounded-full shadow-lg hover:bg-amber-500 transition-colors cursor-pointer"
        >
          <ShieldPlus size={14} />
          <p className="text-xs font-medium">Add New Admin</p>
        </motion.button>
      </div>

      {/* Admin Cards */}
      <div className="space-y-6">
        <AnimatePresence>
          {admins.length > 0 ? (
            admins.map((admin) => (
              <AdminCard
                key={admin.id}
                admin={admin}
                onEdit={() => handleOpenModal(admin)}
                onDelete={() => handleDelete(admin)} 
              />
            ))
          ) : (
            <div className="text-center p-10  rounded-xl border border-amber-400/50">
              <p className="text-lg font-sm tracking-wider text-white/70">
                No members found. Click "Add New Member" to start!
              </p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Create / Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <AdminModal
            admin={editingAdmin}
            onClose={() => setShowModal(false)}
            onSubmit={handleSubmit}
            error={error}
            setError={setError}
          />
        )}
      </AnimatePresence>

      <ConfirmModal
        show={!!confirmData}
        title={confirmData?.title}
        message={confirmData?.message}
        onConfirm={confirmData?.onConfirm}
        onCancel={() => setConfirmData(null)}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}

export default Admins;
