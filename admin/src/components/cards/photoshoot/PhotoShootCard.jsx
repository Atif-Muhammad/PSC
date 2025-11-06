import { motion } from "framer-motion";
import { Pencil, Trash2, Camera } from "lucide-react";

const PhotoShootCard = ({ photoshoot, onEdit, onDelete }) => {
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
          <Camera className="text-amber-400" size={18} />
          Photoshoot #{photoshoot.id}
        </h3>
        <p className="text-white/80 mt-1">{photoshoot.description}</p>
        <p className="text-sm text-gray-400 mt-1">
          Member: Rs. {photoshoot.memberCharges} | Guest: Rs. {photoshoot.guestCharges}
        </p>
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

export default PhotoShootCard;
