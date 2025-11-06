import { useState } from "react";
import { motion } from "framer-motion";
import { X, Save, UserPlus, Key, Eye, EyeClosed } from "lucide-react";


const AdminModal = ({ admin, onClose, onSubmit, error, setError }) => {
    const isNew = !admin;
    const [formData, setFormData] = useState(admin || { name: '', email: '', password: '', role: 'ADMIN' });

    const [showPass, setShowPass] = useState(false)

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!formData.name || !formData.email || (!formData.password && isNew)) {
            setError('Please fill out all required fields (Name, Email, and Password for new admins).');
            return;
        }

        const payload = isNew
            ? formData
            : { adminID: formData.id, ...formData }; 

        await onSubmit(payload, isNew);
    };


    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="bg-primary-dark border border-amber-400/50 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
                {/* Modal Header */}
                <div className="p-5 border-b border-amber-400/30 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-white flex items-center">
                        <UserPlus className="w-6 h-6 text-amber-400 mr-2" />
                        {isNew ? 'Create New Admin' : 'Edit Admin'}
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full text-white hover:bg-amber-400/20 transition-colors cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                {/* Modal Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <p className="p-2 bg-red-800/50 text-red-300 rounded-lg text-sm text-center">{error}</p>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-amber-400 mb-1" htmlFor="name">Name</label>
                        <input
                            type="text"
                            name="name"
                            id="name"
                            value={formData.name}
                            onChange={handleChange}
                            className="w-full p-3 rounded-lg bg-primary-light border border-primary-light text-white  transition"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-amber-400 mb-1" htmlFor="email">Email</label>
                        <input
                            type="email"
                            name="email"
                            id="email"
                            autoComplete="off"
                            value={formData.email}
                            onChange={handleChange}
                            className="w-full p-3 rounded-lg bg-primary-light border border-primary-light text-white transition"
                            required
                        />
                    </div>
                    <div className={`${isNew ? '' : 'text-gray-500'} relative`}>
                        <label className="block text-sm font-medium text-amber-400 mb-1" htmlFor="password">Password {isNew ? '*' : '(Optional for update)'}</label>
                        <input
                            type={showPass ? "text" : "password"}
                            name="password"
                            id="password"
                            autoComplete="new-password"
                            value={formData.password}
                            onChange={handleChange}
                            className="w-full p-3 rounded-lg bg-primary-light border border-primary-light text-white transition"
                            required={isNew}
                            placeholder={isNew ? "Enter new password" : "Leave blank to keep existing password"}
                        />
                        <div className="absolute right-2 top-9 text-amber-400 cursor-pointer" onClick={() => setShowPass(!showPass)}>{showPass ? <Eye /> : <EyeClosed />}</div>
                        <p className="text-xs mt-1 text-gray-500 flex items-center"><Key size={12} className="mr-1" /> Only enter a password if you want to change it.</p>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end pt-4 border-t border-gray-800">
                        <motion.button
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            className="flex items-center gap-x-1 text-sm px-6 py-3 bg-amber-400 text-gray-950 font-semibold cursor-pointer rounded-full hover:bg-amber-500 transition-colors"
                        >
                            <Save size={16} className="" />
                            {isNew ? 'Create Admin' : 'Save Changes'}
                        </motion.button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};


export default AdminModal;