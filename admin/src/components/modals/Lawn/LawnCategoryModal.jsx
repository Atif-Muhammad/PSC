import { useState } from "react";
import { motion } from "framer-motion";
import { X, Plus, Pencil, Trash2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import {
  createLawnCategory,
  updateLawnCategory,
  deleteLawnCategory,
} from "../../../../config/apis";

const LawnCategoryModal = ({ onClose, categories, queryClient }) => {
  const [form, setForm] = useState({ id: null, category: "" });
  const [error, setError] = useState("");
//   console.log(categories)

  const createMutation = useMutation({
    mutationFn: createLawnCategory,
    onSuccess: async () => {
      await queryClient.invalidateQueries(["lawnCategories"]);
      setForm({ id: null, category: "" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateLawnCategory,
    onSuccess: async () => {
      await queryClient.invalidateQueries(["lawnCategories"]);
      setForm({ id: null, category: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLawnCategory,
    onSuccess: async () => {
      await queryClient.invalidateQueries(["lawnCategories"]);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.category.trim()) {
      setError("Category name is required.");
      return;
    }
    if (form.id) updateMutation.mutate(form);
    else createMutation.mutate({ category: form.category });
  };

  const handleEdit = (cat) => {
    setForm({ id: cat.id, category: cat.category });
  };

  const handleDelete = (id) => {
    deleteMutation.mutate(id);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-primary-dark border border-emerald-400/50 rounded-xl w-full max-w-2xl shadow-2xl"
      >
        <div className="p-5 border-b border-emerald-400/30 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-x-2">
            Lawn Categories
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-white hover:bg-emerald-400/20 rounded-full"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Form */}
          <form onSubmit={handleSubmit} className="flex gap-x-3">
            <input
              type="text"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="Enter category name..."
              className="flex-1 p-3 bg-primary-light text-white rounded-lg border border-emerald-400/20"
            />
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="submit"
              className="px-4 py-2 bg-emerald-400 text-gray-900 rounded-lg font-semibold flex items-center gap-x-1"
            >
              <Plus size={14} /> {form.id ? "Update" : "Add"}
            </motion.button>
          </form>
          {error && <p className="text-red-400 text-sm">{error}</p>}

          {/* List */}
          <div className="space-y-2 max-h-80 overflow-y-auto mt-4">
            {categories.length > 0 ? (
              categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex justify-between items-center bg-primary-light border border-emerald-400/20 p-3 rounded-lg text-white"
                >
                  <p>{cat.category}</p>
                  <div className="flex gap-x-2">
                    <button
                      onClick={() => handleEdit(cat)}
                      className="p-2 bg-emerald-400/20 rounded-full hover:bg-emerald-400/30"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id)}
                      className="p-2 bg-red-400/20 rounded-full hover:bg-red-400/30"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-sm text-center py-6">
                No categories added yet.
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default LawnCategoryModal;
