import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Layers3 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getLawns,
  createLawn,
  updateLawn,
  deleteLawn,
  getLawnCategories
} from "../../../../config/apis";
import LawnCard from "../../cards/Lawn/LawnCard";
import LawnModal from "../../modals/Lawn/LawnModal";
import LawnCategoryModal from "../../modals/Lawn/LawnCategoryModal";
import ConfirmModal from "../../ui/modals/ConfirmModal";

function Lawns() {
  const queryClient = useQueryClient();
  const { data: lawns = [] } = useQuery({ queryKey: ["lawns"], queryFn: getLawns, retry: 1 });
  const { data: categories = [] } = useQuery({ queryKey: ["lawnCategories"], queryFn: getLawnCategories });

  const [showModal, setShowModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [confirmData, setConfirmData] = useState(null);

  const createMutation = useMutation({
    mutationFn: createLawn,
    onSuccess: async () => {
      await queryClient.invalidateQueries(["lawns"]);
    //   setShowModal(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateLawn,
    onSuccess: async () => {
      await queryClient.invalidateQueries(["lawns"]);
      setShowModal(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLawn,
    onSuccess: () => {
      queryClient.invalidateQueries(["lawns"]);
      setConfirmData(null);
    },
  });

  const handleSubmit = (data, isNew) => {
    if (isNew) createMutation.mutate(data);
    else updateMutation.mutate(data);
  };

  const handleDelete = (lawn) => {
    setConfirmData({
      title: "Delete Lawn",
      message: `Are you sure you want to delete this lawn?`,
      onConfirm: () => deleteMutation.mutate(lawn.id),
    });
  };

  const handleOpenModal = (lawn = null) => {
    setEditing(lawn);
    setError("");
    setShowModal(true);
  };

  return (
    <div className="min-h-screen font-sans">
      <div className="flex justify-end items-center mb-10 border-b border-emerald-400/50 pb-4 gap-x-3">
        {/* Add Category Button */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowCategoryModal(true)}
          className="flex items-center gap-x-1 px-4 py-2 bg-emerald-700 text-white font-bold rounded-full shadow-lg hover:bg-emerald-600 transition-colors"
        >
          <Layers3 size={14} />
          <p className="text-xs font-medium">Manage Categories</p>
        </motion.button>

        {/* Add Lawn Button */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => handleOpenModal()}
          className="flex items-center gap-x-1 px-4 py-2 bg-emerald-400 text-gray-950 font-bold rounded-full shadow-lg hover:bg-emerald-500 transition-colors"
        >
          <Plus size={14} />
          <p className="text-xs font-medium">Add Lawn</p>
        </motion.button>
      </div>

      <div className="space-y-6">
        <AnimatePresence>
          {lawns.length > 0 ? (
            lawns.map((lawn) => (
              <LawnCard
                key={lawn.id}
                lawn={lawn}
                onEdit={() => handleOpenModal(lawn)}
                onDelete={() => handleDelete(lawn)}
              />
            ))
          ) : (
            <div className="text-center p-10 rounded-xl border border-emerald-400/50">
              <p className="text-lg text-white/70">No lawns found. Add one to begin!</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Lawn Modal */}
      <AnimatePresence>
        {showModal && (
          <LawnModal
            lawn={editing}
            onClose={() => setShowModal(false)}
            onSubmit={handleSubmit}
            error={error}
            setError={setError}
            categories={categories}
          />
        )}
      </AnimatePresence>

      {/* Lawn Category Modal */}
      <AnimatePresence>
        {showCategoryModal && (
          <LawnCategoryModal
            onClose={() => setShowCategoryModal(false)}
            categories={categories}
            queryClient={queryClient}
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

export default Lawns;
