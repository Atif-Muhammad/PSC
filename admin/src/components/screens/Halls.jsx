import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import HallCard from "../cards/HallCard";
import HallModal from "../modals/HallModal";
import ConfirmModal from "../ui/modals/ConfirmModal";
import { getHalls, createHall, updateHall, deleteHall } from "../../../config/apis";

function Halls() {
  const queryClient = useQueryClient();
  const { data: halls = [] } = useQuery({ queryKey: ["halls"], queryFn: getHalls, retry: 1 });
  const [showModal, setShowModal] = useState(false);
  const [editingHall, setEditingHall] = useState(null);
  const [error, setError] = useState("");
  const [confirmData, setConfirmData] = useState(null);

  const createMutation = useMutation({
    mutationFn: createHall,
    onSuccess: async () => {
      await queryClient.invalidateQueries(["halls"]);
      setShowModal(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateHall,
    onSuccess: async () => {
      await queryClient.invalidateQueries(["halls"]);
      setShowModal(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteHall,
    onSuccess: () => {
      queryClient.invalidateQueries(["halls"]);
      setConfirmData(null);
    },
  });

  const handleSubmit = (data, isNew) => {
    if (isNew) createMutation.mutate(data);
    else updateMutation.mutate(data);
  };

  const handleDelete = (hall) => {
    setConfirmData({
      title: "Delete Hall",
      message: `Are you sure you want to delete "${hall.name}"?`,
      onConfirm: () => deleteMutation.mutate(hall.id),
    });
  };

  const handleOpenModal = (hall = null) => {
    setEditingHall(hall);
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
          <p className="text-xs font-medium">Add Hall</p>
        </motion.button>
      </div>

      <div className="space-y-6">
        <AnimatePresence>
          {halls.length > 0 ? (
            halls.map((hall) => (
              <HallCard
                key={hall.id}
                hall={hall}
                onEdit={() => handleOpenModal(hall)}
                onDelete={() => handleDelete(hall)}
              />
            ))
          ) : (
            <div className="text-center p-10 rounded-xl border border-amber-400/50">
              <p className="text-lg text-white/70">No halls found. Add one to begin!</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Hall Modal */}
      <AnimatePresence>
        {showModal && (
          <HallModal
            hall={editingHall}
            onClose={() => setShowModal(false)}
            onSubmit={handleSubmit}
            error={error}
            setError={setError}
          />
        )}
      </AnimatePresence>

      {/* Confirm Delete */}
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

export default Halls;
