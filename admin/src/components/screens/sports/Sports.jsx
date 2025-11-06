import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import SportCard from "../../cards/sports/SportsCard";
import SportModal from "../../modals/sports/SportsModal";
import ConfirmModal from "../../ui/modals/ConfirmModal";
import { getSports, createSport, updateSport, deleteSport } from "../../../../config/apis";

function Sports() {
  const queryClient = useQueryClient();
  const { data: sports = [] } = useQuery({ queryKey: ["sports"], queryFn: getSports, retry: 1 });

  const [showModal, setShowModal] = useState(false);
  const [editingSport, setEditingSport] = useState(null);
  const [error, setError] = useState("");
  const [confirmData, setConfirmData] = useState(null);

  const createMutation = useMutation({
    mutationFn: createSport,
    onSuccess: async () => {
      await queryClient.invalidateQueries(["sports"]);
      setShowModal(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateSport,
    onSuccess: async () => {
      await queryClient.invalidateQueries(["sports"]);
      setShowModal(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSport,
    onSuccess: () => {
      queryClient.invalidateQueries(["sports"]);
      setConfirmData(null);
    },
  });

  const handleSubmit = (data, isNew) => {
    if (isNew) createMutation.mutate(data);
    else updateMutation.mutate(data);
  };

  const handleDelete = (sport) => {
    setConfirmData({
      title: "Delete Sport",
      message: `Are you sure you want to delete "${sport.activity}"?`,
      onConfirm: () => deleteMutation.mutate(sport.id),
    });
  };

  const handleOpenModal = (sport = null) => {
    setEditingSport(sport);
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
          <p className="text-xs font-medium">Add Sport</p>
        </motion.button>
      </div>

      <div className="space-y-6">
        <AnimatePresence>
          {sports.length > 0 ? (
            sports.map((sport) => (
              <SportCard
                key={sport.id}
                sport={sport}
                onEdit={() => handleOpenModal(sport)}
                onDelete={() => handleDelete(sport)}
              />
            ))
          ) : (
            <div className="text-center p-10 rounded-xl border border-amber-400/50">
              <p className="text-lg text-white/70">No sports found. Add one to begin!</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <SportModal
            sport={editingSport}
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

export default Sports;
