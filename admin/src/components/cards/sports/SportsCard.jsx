import { motion } from "framer-motion";
import { Pencil, Trash2, Dumbbell } from "lucide-react";

const SportsCard = ({ sport, onEdit, onDelete }) => {
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
          <Dumbbell className="text-amber-400" size={18} />
          {sport.activity}
        </h3>
        <p className="text-sm text-gray-300">{sport.description}</p>

        {sport.sportCharge?.length > 0 && (
          <div className="mt-2 text-sm text-gray-400 space-y-1">
            {sport.sportCharge.map((charge) => (
              <div key={charge.id}>
                <span className="text-amber-400 font-semibold">{charge.chargeType}:</span>{" "}
                Member Rs.{charge.memberCharges} | Spouse Rs.{charge.spouseCharges} | Children's Rs.{charge.childrenCharges} | Guest Rs.{charge.guestCharges} | Affiliated Clubs Rs.{charge.affiliatedClubCharges}
              </div>
            ))}
          </div>
        )}

        <p
          className={`text-sm mt-1 font-semibold ${
            sport.isActive ? "text-green-400" : "text-red-400"
          }`}
        >
          {sport.isActive ? "Active" : "Inactive"}
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

export default SportsCard;
