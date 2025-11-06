import { motion } from "framer-motion";
import { Pencil, Trash2, Trees } from "lucide-react";

const LawnCard = ({ lawn, onEdit, onDelete }) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-primary-light border border-emerald-400/30 rounded-xl p-4 flex justify-between items-center text-white"
    >
      <div>
        <h3 className="text-lg font-bold flex items-center gap-x-2">
          <Trees className="text-emerald-400" size={18} />
          {lawn.lawnCategory?.category} Lawn
        </h3>
        <p className="text-sm text-gray-300">Description: {lawn.description}</p>
        <p className="text-sm text-gray-400">
          Capacity: {lawn.minGuests} - {lawn.maxGuests} guests
        </p>
        <p className="text-sm text-gray-400">
          Member: Rs. {lawn.memberCharges} | Guest: Rs. {lawn.guestCharges}
        </p>
      </div>

      <div className="flex gap-x-2">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onEdit}
          className="p-2 rounded-full bg-emerald-400/20 hover:bg-emerald-400/30"
        >
          <Pencil size={16} />
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onDelete}
          className="p-2 rounded-full bg-red-400/20 hover:bg-red-400/30"
        >
          <Trash2 size={16} />
        </motion.button>
      </div>
    </motion.div>
  );
};

export default LawnCard;
