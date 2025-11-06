import { useState } from "react";
import { motion } from "framer-motion";
import { X, Save, Dumbbell } from "lucide-react";

const CHARGE_TYPES = ["PER_DAY", "PER_MONTH", "PER_GAME", "PER_HOUR"];

const SportsModal = ({ sport, onClose, onSubmit, error, setError }) => {
  const isNew = !sport;

  const [formData, setFormData] = useState(
    sport || {
      activity: "",
      description: "",
      isActive: true,
      sportCharge: [],
    }
  );

  const handleAddCharge = () => {
    setFormData((prev) => ({
      ...prev,
      sportCharge: [...prev.sportCharge, { chargeType: "PER_DAY", memberCharges: 0 }],
    }));
  };

  const handleChargeChange = (index, field, value) => {
    const updated = [...formData.sportCharge];
    updated[index][field] = value;
    setFormData((prev) => ({ ...prev, sportCharge: updated }));
  };

  const handleRemoveCharge = (index) => {
    const updated = [...formData.sportCharge];
    updated.splice(index, 1);
    setFormData((prev) => ({ ...prev, sportCharge: updated }));
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.activity) {
      setError("Activity name is required.");
      return;
    }
    await onSubmit(formData, isNew);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-primary-dark border border-amber-400/50 rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-5 border-b border-amber-400/30 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <Dumbbell className="w-6 h-6 text-amber-400 mr-2" />
            {isNew ? "Add Sport" : "Edit Sport"}
          </h2>
          <button onClick={onClose} className="p-2 rounded-full text-white hover:bg-amber-400/20">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {error && (
            <p className="p-2 bg-red-800/50 text-red-300 rounded-lg text-sm text-center">{error}</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-amber-400 mb-1 block">Activity</label>
              <input
                name="activity"
                value={formData.activity}
                onChange={handleChange}
                className="w-full p-3 rounded-lg bg-primary-light border border-primary-light text-white"
                placeholder="e.g., Tennis, Swimming"
                required
              />
            </div>
            <div className="flex items-center gap-x-2 mt-2">
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
              />
              <label className="text-sm text-amber-400">Active</label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-amber-400 mb-1">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="w-full p-3 rounded-lg bg-primary-light border border-primary-light text-white"
              placeholder="Describe the sport..."
            />
          </div>

          {/* Charges */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-amber-400 font-semibold">Charges</h3>
              <motion.button
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={handleAddCharge}
                className="px-3 py-1 bg-amber-400 text-gray-950 text-sm rounded-full font-bold"
              >
                + Add Charge
              </motion.button>
            </div>

            {formData.sportCharge.map((charge, index) => (
              <div
                key={index}
                className="grid grid-cols-1 md:grid-cols-6 gap-2 p-3 border border-amber-400/20 rounded-lg bg-primary-light"
              >
                <select
                  value={charge.chargeType}
                  onChange={(e) => handleChargeChange(index, "chargeType", e.target.value)}
                  className="p-2 rounded-md bg-primary-dark text-white border border-amber-400/30"
                >
                  {CHARGE_TYPES.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>

                {["memberCharges", "spouseCharges", "childrenCharges", "guestCharges", "affiliatedClubCharges"].map(
                  (field) => (
                    <input
                      key={field}
                      type="number"
                      placeholder={field.replace("Charges", "")}
                      value={charge[field] || ""}
                      onChange={(e) => handleChargeChange(index, field, e.target.value)}
                      className="p-2 rounded-md bg-primary-dark text-white border border-amber-400/30"
                    />
                  )
                )}

                <button
                  type="button"
                  onClick={() => handleRemoveCharge(index)}
                  className="text-red-400 text-sm font-semibold mt-2 md:mt-0"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-800">
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="flex items-center gap-x-1 text-sm px-6 py-3 bg-amber-400 text-gray-950 font-semibold rounded-full hover:bg-amber-500"
            >
              <Save size={16} />
              {isNew ? "Add Sport" : "Save Changes"}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default SportsModal;
