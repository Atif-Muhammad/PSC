import { useState } from "react";
import { motion } from "framer-motion";
import { X, Save, Home } from "lucide-react";

const RoomModal = ({ room, onClose, onSubmit, error, setError, roomTypes = [] }) => {
  const isNew = !room;

  const [formData, setFormData] = useState(
    room || {
      roomNumber: "",
      roomTypeId: "",
      description: "",
      isActive: true,
      isOutOfOrder: false,
      outOfOrderReason: "",
      outOfOrderFrom: "",
      outOfOrderTo: "",
    }
  );

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === "isActive" && checked) {
      // If activating, remove outOfOrder
      setFormData((prev) => ({ ...prev, isActive: true, isOutOfOrder: false }));
      return;
    }

    if (name === "isOutOfOrder" && checked) {
      setFormData((prev) => ({
        ...prev,
        isOutOfOrder: true,
        isActive: false,
        outOfOrderFrom: !isNew ? new Date().toISOString().split("T")[0] : prev.outOfOrderFrom,
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

    if (!formData.roomNumber || !formData.roomTypeId) {
      setError("Room number and type are required.");
      return;
    }

    const { createdAt, updatedAt, roomType, ...cleanData } = formData;
  
    // If room is not out of order, clear related fields
    if (!formData.isOutOfOrder) {
      delete cleanData.outOfOrderFrom;
      delete cleanData.outOfOrderTo;
      delete cleanData.outOfOrderReason;
    }

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
            {isNew ? "Add Room" : "Edit Room"}
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
            {/* Room Number */}
            <div>
              <label className="block text-sm font-medium text-amber-400 mb-1">Room No</label>
              <input
                name="roomNumber"
                value={formData.roomNumber}
                onChange={handleChange}
                className="w-full p-3 rounded-lg bg-primary-light border border-primary-light text-white"
                required
              />
            </div>

            {/* Room Type */}
            <div>
              <label className="block text-sm font-medium text-amber-400 mb-1">Room Type</label>
              <select
                name="roomTypeId"
                value={formData.roomTypeId}
                onChange={handleChange}
                className="w-full p-3 rounded-lg bg-primary-light border border-primary-light text-white"
                required
              >
                <option value="">Select Type</option>
                {roomTypes?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.type}
                  </option>
                ))}
              </select>
            </div>

            {/* Active / Out of Order */}
            <div className="flex items-center gap-x-3 mt-2">
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
                  name="isOutOfOrder"
                  checked={formData.isOutOfOrder}
                  onChange={handleChange}
                />
                Out of Order
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
              placeholder="Room description..."
            />
          </div>

          {/* Out of Order Fields */}
          {formData.isOutOfOrder && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Reason */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-amber-400 mb-1">
                  Out of Order Reason
                </label>
                <textarea
                  name="outOfOrderReason"
                  value={formData.outOfOrderReason}
                  onChange={handleChange}
                  className="w-full p-3 rounded-lg bg-primary-light border border-primary-light text-white"
                  placeholder="Reason for out of order..."
                />
              </div>

              {/* Only To Date */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-amber-400 mb-1">Until</label>
                <input
                  type="date"
                  name="outOfOrderTo"
                  min={new Date().toISOString().split("T")[0]}
                  value={formData.outOfOrderTo}
                  onChange={handleChange}
                  className="w-full p-3 rounded-lg bg-primary-light border border-primary-light text-white"
                />
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end pt-4 border-t border-gray-800">
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="flex items-center gap-x-1 text-sm px-6 py-3 bg-amber-400 text-gray-950 font-semibold rounded-full hover:bg-amber-500"
            >
              <Save size={16} />
              {isNew ? "Add Room" : "Save Changes"}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default RoomModal;
