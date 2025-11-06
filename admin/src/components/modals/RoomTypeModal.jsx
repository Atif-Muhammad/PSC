import { useState } from "react";
import { motion } from "framer-motion";

function RoomTypeModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({
    type: "",
    priceGuest: "",
    priceMember: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    if (!form.type.trim() || !form.priceGuest || !form.priceMember) return;
    onSubmit({
      type: form.type,
      priceGuest: parseFloat(form.priceGuest),
      priceMember: parseFloat(form.priceMember),
    });
  };

  return (
    <motion.div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-sm"
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
      >
        <h2 className="text-xl font-bold text-gray-800 mb-4">Create Room Type</h2>

        <div className="space-y-3">
          <input
            name="type"
            value={form.type}
            onChange={handleChange}
            placeholder="Room Type (e.g., Deluxe)"
            className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-amber-400 outline-none"
          />

          <input
            name="priceGuest"
            type="number"
            value={form.priceGuest}
            onChange={handleChange}
            placeholder="Guest Price"
            className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-amber-400 outline-none"
          />

          <input
            name="priceMember"
            type="number"
            value={form.priceMember}
            onChange={handleChange}
            placeholder="Member Price"
            className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-amber-400 outline-none"
          />
        </div>

        <div className="flex justify-end gap-x-2 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-amber-400 rounded-lg font-bold hover:bg-amber-500 transition"
          >
            Create
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default RoomTypeModal;
