import { motion } from "framer-motion";
import { Pencil, Trash2, User, Mail, Shield, X } from "lucide-react";
import psc from "../../assets/psc_logo_gold.png";

const AdminCard = ({ admin, onEdit, onDelete }) => {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className="relative bg-primary-dark border-2 border-amber-400/50 rounded-xl shadow-2xl overflow-hidden p-6 w-full max-w-4xl mx-auto
                       flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6 transition-all duration-300
                       hover:shadow-[0_0_20px_rgba(255,215,0,0.4)]"
        >
            {/* Golden Ribbon Edge (Unique Touch) */}
            <div className="absolute top-0 left-0 h-full w-2 bg-amber-400 opacity-70"></div>

            {/* User Image/Icon */}
            <div className="relative">
                <img
                    src={psc}
                    alt={admin.name}
                    className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg"
                />
                <Shield className="absolute bottom-0 right-0 w-5 h-5 text-amber-400 bg-primary-dark rounded-full p-0.5" />
            </div>

            {/* Details Section */}
            <div className="flex-1 text-center sm:text-left space-y-1">
                <div className="flex items-center justify-center sm:justify-start space-x-2">
                    <User className="w-5 h-5 text-amber-400" />
                    <h3 className="text-xl font-bold text-white uppercase tracking-wider">
                        {admin.name}
                    </h3>
                </div>

                <div className="flex items-center justify-center sm:justify-start space-x-2 text-sm text-gray-300">
                    <Mail className="w-4 h-4 text-amber-500/80" />
                    <p>{admin.email}</p>
                </div>

                <div className="text-xs pt-2">
                    <span className="font-semibold text-amber-400 mr-2">ROLE:</span>
                    <span className="text-white bg-amber-600/20 px-2 py-0.5 rounded-full text-xs font-mono">
                        {admin.role}
                    </span>
                </div>

                <p className="text-xs text-gray-500 pt-1">
                    Created: {new Date(admin.createdAt).toLocaleDateString()}
                </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-row sm:flex-col gap-3">
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onEdit(admin)}
                    className="p-3 rounded-full bg-amber-400 text-gray-950 font-semibold shadow-md hover:bg-amber-300 transition-colors flex items-center justify-center"
                    title="Edit Admin"
                >
                    <Pencil size={18} />
                </motion.button>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onDelete(admin.id)}
                    className="p-3 rounded-full bg-white text-gray-950 font-semibold shadow-md hover:bg-gray-200 transition-colors flex items-center justify-center"
                    title="Delete Admin"
                >
                    <Trash2 size={18} />
                </motion.button>
            </div>
        </motion.div>
    );
};

export default AdminCard;
