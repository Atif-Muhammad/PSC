import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PhotoshootCard from "../../cards/photoshoot/PhotoShootCard";
import PhotoshootModal from "../../modals/photoshoot/PhotoShootModal";
import ConfirmModal from "../../ui/modals/ConfirmModal";
import { getPhotoshoots, createPhotoshoot, updatePhotoshoot, deletePhotoshoot } from "../../../../config/apis";

function PhotoShoots() {
  const queryClient = useQueryClient();
  const { data: photoshoots = [] } = useQuery({ queryKey: ["photoshoots"], queryFn: getPhotoshoots, retry: 1 });

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [error, setError] = useState("");
  const [confirmData, setConfirmData] = useState(null);

  const createMutation = useMutation({
    mutationFn: createPhotoshoot,
    onSuccess: async () => {
      await queryClient.invalidateQueries(["photoshoots"]);
      setShowModal(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: updatePhotoshoot,
    onSuccess: async () => {
      await queryClient.invalidateQueries(["photoshoots"]);
      setShowModal(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deletePhotoshoot,
    onSuccess: () => {
      queryClient.invalidateQueries(["photoshoots"]);
      setConfirmData(null);
    },
  });

  const handleSubmit = (data, isNew) => {
    if (isNew) createMutation.mutate(data);
    else updateMutation.mutate(data);
  };

  const handleDelete = (p) => {
    setConfirmData({
      title: "Delete Photoshoot",
      message: `Are you sure you want to delete this photoshoot?`,
      onConfirm: () => deleteMutation.mutate(p.id),
    });
  };

  const handleOpenModal = (p = null) => {
    setEditingItem(p);
    setError("");
    setShowModal(true);
  };

  return (
    <div className="min-h-screen font-sans">
      <div className="flex justify-end items-center mb-10 border-b border-amber-400/50 pb-4 gap-x-3">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => handleOpenModal()}
          className="flex items-center gap-x-1 px-4 py-2 bg-amber-400 text-gray-950 font-bold rounded-full shadow-lg hover:bg-amber-500 transition-colors"
        >
          <Plus size={14} />
          <p className="text-xs font-medium">Add Photoshoot</p>
        </motion.button>
      </div>

      <div className="space-y-6">
        <AnimatePresence>
          {photoshoots.length > 0 ? (
            photoshoots.map((p) => (
              <PhotoshootCard
                key={p.id}
                photoshoot={p}
                onEdit={() => handleOpenModal(p)}
                onDelete={() => handleDelete(p)}
              />
            ))
          ) : (
            <div className="text-center p-10 rounded-xl border border-amber-400/50">
              <p className="text-lg text-white/70">No photoshoots found. Add one to begin!</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showModal && (
          <PhotoshootModal
            photoshoot={editingItem}
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

export default PhotoShoots;
