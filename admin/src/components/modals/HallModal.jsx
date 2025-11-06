import { useState } from "react";
import { motion } from "framer-motion";
import { X, Save, Home } from "lucide-react";

const HallModal = ({ hall, onClose, onSubmit, error, setError }) => {
  const isNew = !hall;

  const [formData, setFormData] = useState(
    hall || {
      name: "",
      description: "",
      capacity: 0,
      chargesMembers: 0,
      chargesGuests: 0,
      isActive: true,
      isOutOfService: false,
      outOfServiceReason: "",
      outOfServiceFrom: "",
      outOfServiceTo: "",
    }
  );

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === "isActive" && checked) {
      setFormData((prev) => ({ ...prev, isActive: true, isOutOfService: false }));
      return;
    }

    if (name === "isOutOfService" && checked) {
      setFormData((prev) => ({
        ...prev,
        isOutOfService: true,
        isActive: false,
        // Only set from date if updating an existing hall
        outOfServiceFrom: !isNew ? new Date().toISOString() : prev.outOfServiceFrom,
      }));
      return;
    }

    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.name || !formData.capacity) {
      setError("Name and capacity are required.");
      return;
    }

    const { createdAt, updatedAt, ...cleanData } = formData;

    // Clear out-of-service fields if not marked
    if (!formData.isOutOfService) {
      delete cleanData.outOfServiceFrom;
      delete cleanData.outOfServiceTo;
      delete cleanData.outOfServiceReason;
    }
    console.log(cleanData)
    await onSubmit(cleanData, isNew);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-primary-dark border border-amber-400/50 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-5 border-b border-amber-400/30 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <Home className="w-6 h-6 text-amber-400 mr-2" />
            {isNew ? "Add Hall" : "Edit Hall"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-white hover:bg-amber-400/20"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <p className="p-2 bg-red-800/50 text-red-300 rounded-lg text-sm text-center">
              {error}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-amber-400 mb-1">Name</label>
              <input
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full p-3 rounded-lg bg-primary-light border border-primary-light text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-amber-400 mb-1">Capacity</label>
              <input
                type="number"
                name="capacity"
                value={formData.capacity}
                onChange={handleChange}
                className="w-full p-3 rounded-lg bg-primary-light border border-primary-light text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-amber-400 mb-1">Member Charges</label>
              <input
                type="number"
                name="chargesMembers"
                value={formData.chargesMembers}
                onChange={handleChange}
                className="w-full p-3 rounded-lg bg-primary-light border border-primary-light text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-amber-400 mb-1">Guest Charges</label>
              <input
                type="number"
                name="chargesGuests"
                value={formData.chargesGuests}
                onChange={handleChange}
                className="w-full p-3 rounded-lg bg-primary-light border border-primary-light text-white"
              />
            </div>

            {/* Active / Out of Service */}
            <div className="flex items-center gap-x-3 mt-2 md:col-span-2">
              <label className="flex items-center gap-x-2 text-sm text-amber-400">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                />
                Active
              </label>
              <label className="flex items-center gap-x-2 text-sm text-amber-400">
                <input
                  type="checkbox"
                  name="isOutOfService"
                  checked={formData.isOutOfService}
                  onChange={handleChange}
                />
                Out of Service
              </label>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-amber-400 mb-1">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="w-full p-3 rounded-lg bg-primary-light border border-primary-light text-white"
              placeholder="Hall description..."
            />
          </div>

          {/* Out of Service Fields */}
          {formData.isOutOfService && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-amber-400 mb-1">
                  Reason
                </label>
                <textarea
                  name="outOfServiceReason"
                  value={formData.outOfServiceReason}
                  onChange={handleChange}
                  className="w-full p-3 rounded-lg bg-primary-light border border-primary-light text-white"
                  placeholder="Reason for out of service..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-amber-400 mb-1">To</label>
                <input
                  type="date"
                  name="outOfServiceTo"
                  value={formData.outOfServiceTo?.split("T")[0] || ""}
                  onChange={handleChange}
                  className="w-full p-3 rounded-lg bg-primary-light border border-primary-light text-white"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-gray-800">
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="flex items-center gap-x-1 text-sm px-6 py-3 bg-amber-400 text-gray-950 font-semibold rounded-full hover:bg-amber-500"
            >
              <Save size={16} />
              {isNew ? "Add Hall" : "Save Changes"}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default HallModal;
