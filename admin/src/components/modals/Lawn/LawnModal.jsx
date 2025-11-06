import { useState } from "react";
import { motion } from "framer-motion";
import { X, Save, Leaf } from "lucide-react";

const LawnModal = ({ lawn, onClose, onSubmit, error, setError, categories = [] }) => {
  const isNew = !lawn;
  const [form, setForm] = useState(
    lawn || {
      description: "",
      lawnCategoryId: "",
      minGuests: "",
      maxGuests: "",
      memberCharges: "",
      guestCharges: "",
    }
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    if (!form.lawnCategoryId || !form.description.trim()) {
      setError("Category and description are required.");
      return;
    }
    const clean = {
      ...form,
      minGuests: Number(form.minGuests),
      maxGuests: Number(form.maxGuests),
      memberCharges: Number(form.memberCharges),
      guestCharges: Number(form.guestCharges),
    };
    onSubmit(clean, isNew);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-primary-dark border border-emerald-400/50 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 border-b border-emerald-400/30 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <Leaf className="w-6 h-6 text-emerald-400 mr-2" />
            {isNew ? "Add Lawn" : "Edit Lawn"}
          </h2>
          <button onClick={onClose} className="p-2 text-white hover:bg-emerald-400/20 rounded-full">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="p-2 bg-red-800/50 text-red-300 rounded-lg text-sm text-center">{error}</p>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-emerald-400 mb-1 block">Category</label>
              <select
                name="lawnCategoryId"
                value={form.lawnCategoryId}
                onChange={handleChange}
                className="w-full p-3 rounded-lg bg-primary-light border border-primary-light text-white"
                required
              >
                <option value="">Select Category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-emerald-400 mb-1 block">Description</label>
              <input
                name="description"
                value={form.description}
                onChange={handleChange}
                className="w-full p-3 rounded-lg bg-primary-light border border-primary-light text-white"
                placeholder="Short description..."
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-emerald-400 mb-1 block">Min Guests</label>
              <input
                name="minGuests"
                type="number"
                min={0}
                max={form.maxGuests - 1}
                value={form.minGuests}
                onChange={handleChange}
                className="w-full p-3 rounded-lg bg-primary-light border border-primary-light text-white"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-emerald-400 mb-1 block">Max Guests</label>
              <input
                name="maxGuests"
                type="number"
                min={parseInt(form.minGuests) + 1}
                value={form.maxGuests}
                onChange={handleChange}
                className="w-full p-3 rounded-lg bg-primary-light border border-primary-light text-white"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-emerald-400 mb-1 block">Member Charges</label>
              <input
                name="memberCharges"
                type="number"
                min="0"
                value={form.memberCharges}
                onChange={handleChange}
                className="w-full p-3 rounded-lg bg-primary-light border border-primary-light text-white"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-emerald-400 mb-1 block">Guest Charges</label>
              <input
                name="guestCharges"
                type="number"
                min="0"
                value={form.guestCharges}
                onChange={handleChange}
                className="w-full p-3 rounded-lg bg-primary-light border border-primary-light text-white"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-800">
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="flex items-center gap-x-1 text-sm px-6 py-3 bg-emerald-400 text-gray-950 font-semibold rounded-full hover:bg-emerald-500"
            >
              <Save size={16} />
              {isNew ? "Add Lawn" : "Save Changes"}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default LawnModal;
