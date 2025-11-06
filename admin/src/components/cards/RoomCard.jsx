import { motion } from "framer-motion";
import { Pencil, Trash2, DoorOpen } from "lucide-react";
import { toLocalTime } from "../../utils/toLocalTime";

const RoomCard = ({ room, onEdit, onDelete }) => {
  // console.log(room)
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
          Room #{room.roomNumber}
        </h3>
        <p className="text-sm text-gray-300">Type: {room.roomType?.type}</p>
        <p className="text-sm text-gray-400">
          Member: Rs. {room.roomType?.priceGuest} | Guest: Rs. {room.roomType?.priceMember}
        </p>

        <p
          className={`text-sm mt-1 font-semibold ${
            room.isOutOfOrder
              ? "text-red-400"
              : room.isActive
              ? "text-green-400"
              : "text-yellow-400"
          }`}
        >
          {room.isOutOfOrder ? `Out of Order -- From "${toLocalTime(room.outOfOrderFrom)}" -- to "${toLocalTime(room.outOfOrderTo)}"` : room.isActive ? "Active" : "Inactive"}
        </p>
        {room.isOutOfOrder && <p className="text-white/60">Reason: {room.outOfOrderReason}</p> }
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

export default RoomCard;
