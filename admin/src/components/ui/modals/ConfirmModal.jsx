import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle } from "lucide-react";

const ConfirmModal = ({ show, title, message, onConfirm, onCancel, confirmText = "Confirm", cancelText = "Cancel" }) => {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 18 }}
            className="bg-primary-dark border border-amber-400/50 rounded-xl shadow-2xl max-w-sm w-full p-6"
          >
            {/* Header */}
            <div className="flex justify-between items-center border-b border-amber-400/30 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-x-2">
                <AlertTriangle className="text-amber-400" />
                {title || "Are you sure?"}
              </h3>
              <button
                onClick={onCancel}
                className="text-gray-400 hover:text-amber-400 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Message */}
            <p className="text-gray-300 mt-4 text-sm leading-relaxed">
              {message || "This action cannot be undone."}
            </p>

            {/* Buttons */}
            <div className="flex justify-end mt-6 gap-3">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onCancel}
                className="px-4 py-2 text-sm rounded-full bg-gray-700 text-gray-200 hover:bg-gray-600 transition"
              >
                {cancelText}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onConfirm}
                className="px-4 py-2 text-sm rounded-full bg-amber-400 text-gray-950 font-semibold hover:bg-amber-500 transition"
              >
                {confirmText}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmModal;
