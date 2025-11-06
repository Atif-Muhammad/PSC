import { useState } from "react";
import { motion } from "framer-motion";
import { X, Save, Camera } from "lucide-react";

const PhotoShootModal = ({ photoshoot, onClose, onSubmit, error, setError }) => {
  const isNew = !photoshoot;

  const [formData, setFormData] = useState(
    photoshoot || {
      description: "",
      memberCharges: 0,
      guestCharges: 0,
    }
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.description) {
      setError("Description is required.");
      return;
    }

    const { createdAt, updatedAt, ...cleanData } = formData;
    await onSubmit(cleanData, isNew);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-primary-dark border border-amber-400/50 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 border-b border-amber-400/30 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <Camera className="w-6 h-6 text-amber-400 mr-2" />
            {isNew ? "Add Photoshoot" : "Edit Photoshoot"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-white hover:bg-amber-400/20"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <p className="p-2 bg-red-800/50 text-red-300 rounded-lg text-sm text-center">
              {error}
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-amber-400 mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="w-full p-3 rounded-lg bg-primary-light border border-primary-light text-white"
              placeholder="Photoshoot description..."
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-amber-400 mb-1">
                Member Charges (Rs)
              </label>
              <input
                type="number"
                name="memberCharges"
                value={formData.memberCharges}
                onChange={handleChange}
                className="w-full p-3 rounded-lg bg-primary-light border border-primary-light text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-amber-400 mb-1">
                Guest Charges (Rs)
              </label>
              <input
                type="number"
                name="guestCharges"
                value={formData.guestCharges}
                onChange={handleChange}
                className="w-full p-3 rounded-lg bg-primary-light border border-primary-light text-white"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-800">
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="flex items-center gap-x-1 text-sm px-6 py-3 bg-amber-400 text-gray-950 font-semibold rounded-full hover:bg-amber-500"
            >
              <Save size={16} />
              {isNew ? "Add Photoshoot" : "Save Changes"}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default PhotoShootModal;
