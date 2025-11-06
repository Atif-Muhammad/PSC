import { useState } from "react";
import { motion } from "framer-motion";
import { X, Save, UserPlus } from "lucide-react";

const MemberModal = ({ member, onClose, onSubmit, error, setError }) => {
  const isNew = !member;

  const [formData, setFormData] = useState(
    member || {
      Membership_No: "",
      Name: "",
      Email: "",
      Contact_No: "",
      Status: "ACTIVE",
      Balance: 0.0,
      Other_Details: "",
    }
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === "Balance" ? parseFloat(value) || 0 : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (
      !formData.Membership_No ||
      !formData.Name ||
      !formData.Email ||
      !formData.Contact_No
    ) {
      setError("Please fill all required fields (Member ID, Name, Email, Phone).");
      return;
    }

    const payload = isNew
      ? formData
      : { Membership_No: formData.Membership_No, ...formData };

    await onSubmit(payload, isNew);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        className="bg-primary-dark border border-amber-400/50 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-5 border-b border-amber-400/30 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <UserPlus className="w-6 h-6 text-amber-400 mr-2" />
            {isNew ? "Create New Member" : "Edit Member"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-white hover:bg-amber-400/20 transition-colors cursor-pointer"
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

          {/* Form Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Membership No */}
            <div>
              <label className="block text-sm font-medium text-amber-400 mb-1">
                Membership Number
              </label>
              <input
                type="text"
                name="Membership_No"
                value={formData.Membership_No}
                onChange={handleChange}
                className="w-full p-3 rounded-lg bg-primary-light border border-primary-light text-white transition"
                required
              />
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-amber-400 mb-1">
                Name
              </label>
              <input
                type="text"
                name="Name"
                value={formData.Name}
                onChange={handleChange}
                className="w-full p-3 rounded-lg bg-primary-light border border-primary-light text-white transition"
                required
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-amber-400 mb-1">
                Email
              </label>
              <input
                type="email"
                name="Email"
                value={formData.Email}
                onChange={handleChange}
                className="w-full p-3 rounded-lg bg-primary-light border border-primary-light text-white transition"
                required
              />
            </div>

            {/* Contact No */}
            <div>
              <label className="block text-sm font-medium text-amber-400 mb-1">
                Contact Number
              </label>
              <input
                type="text"
                name="Contact_No"
                value={formData.Contact_No}
                onChange={handleChange}
                className="w-full p-3 rounded-lg bg-primary-light border border-primary-light text-white transition"
                required
              />
            </div>

            {/* Balance */}
            <div>
              <label className="block text-sm font-medium text-amber-400 mb-1">
                Balance
              </label>
              <input
                type="number"
                step="0.01"
                name="Balance"
                value={formData.Balance}
                onChange={handleChange}
                className="w-full p-3 rounded-lg bg-primary-light border border-primary-light text-white transition"
              />
            </div>

            {/* Status (only when editing) */}
            {!isNew && (
              <div>
                <label className="block text-sm font-medium text-amber-400 mb-1">
                  Status
                </label>
                <select
                  name="Status"
                  value={formData.Status}
                  onChange={handleChange}
                  className="w-full p-3 rounded-lg bg-primary-light border border-primary-light text-white transition"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="DEACTIVATED">DEACTIVATED</option>
                  <option value="BLOCKED">BLOCKED</option>
                </select>
              </div>
            )}
          </div>

          {/* Other Details (full width) */}
          <div>
            <label className="block text-sm font-medium text-amber-400 mb-1">
              Other Details
            </label>
            <textarea
              name="Other_Details"
              value={formData.Other_Details}
              onChange={handleChange}
              className="w-full p-3 rounded-lg bg-primary-light border border-primary-light text-white transition "
              placeholder="Enter any notes or additional info..."
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end pt-4 border-t border-gray-800">
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="flex items-center gap-x-1 text-sm px-6 py-3 bg-amber-400 text-gray-950 font-semibold cursor-pointer rounded-full hover:bg-amber-500 transition-colors"
            >
              <Save size={16} />
              {isNew ? "Create Member" : "Save Changes"}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default MemberModal;
