import { motion } from "framer-motion";
import { Pencil, Trash2, DoorOpen } from "lucide-react";
import { toLocalTime } from "../../utils/toLocalTime";

const HallCard = ({ hall, onEdit, onDelete }) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-primary-light border border-amber-400/30 rounded-xl p-4 flex justify-between items-center text-white"
    >
      <div>
        <h3 className="text-lg font-bold flex items-center gap-x-2">
          <DoorOpen className="text-amber-400" size={18} />
          {hall.name}
        </h3>
        <p className="text-sm text-gray-300">Capacity: {hall.capacity}</p>
        <p className="text-sm text-gray-400">
          Members: Rs. {hall.chargesMembers} | Guests: Rs. {hall.chargesGuests}
        </p>

        <p
          className={`text-sm mt-1 font-semibold ${
            hall.isOutOfService
              ? "text-red-400"
              : hall.isActive
              ? "text-green-400"
              : "text-yellow-400"
          }`}
        >
          {hall.isOutOfService
            ? `Out of Service -- From "${toLocalTime(hall.outOfServiceFrom)}" -- to "${toLocalTime(hall.outOfServiceTo)}"`
            : hall.isActive
            ? "Active"
            : "Inactive"}
        </p>

        {hall.isOutOfService && hall.outOfServiceReason && (
          <p className="text-white/60">Reason: {hall.outOfServiceReason}</p>
        )}

        {hall.description && <p className="text-white/50 mt-1">{hall.description}</p>}
      </div>

      <div className="flex gap-x-2">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onEdit}
          className="p-2 rounded-full bg-amber-400/20 hover:bg-amber-400/30"
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

export default HallCard;
