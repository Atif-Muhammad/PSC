import { motion } from "framer-motion";
import { Pencil, Trash2, BedDouble, CalendarDays, IndianRupee, User, Clock, Tag, AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

const BookingCard = ({ booking, onEdit, onDelete }) => {
  const {
    id,
    Membership_No,
    roomId,
    checkIn,
    checkOut,
    totalPrice,
    paymentStatus,
    pricingType,
    paidAmount,
    pendingAmount,
    createdAt,
    room,
  } = booking;

  const roomType = room?.roomType?.type || "Unknown";
  const roomNumber = room?.roomNumber;

  // Format dates
  const formatDate = (dateString) =>
    format(new Date(dateString), "dd MMM yyyy");
  const formatTime = (dateString) =>
    format(new Date(dateString), "hh:mm a");

  // Check if booking is expired
  const isExpired = new Date(checkOut) < new Date();

  // Payment status
  const getStatusConfig = () => {
    switch (paymentStatus) {
      case "PAID":
        return {
          color: "text-green-400",
          bg: "bg-green-400/10",
          border: "border-green-400/30",
          icon: <CheckCircle size={14} />,
          label: "Fully Paid",
        };
      case "HALF_PAID":
        return {
          color: "text-yellow-400",
          bg: "bg-yellow-400/10",
          border: "border-yellow-400/30",
          icon: <Clock size={14} />,
          label: "Half Paid",
        };
      case "UNPAID":
      default:
        return {
          color: "text-red-400",
          bg: "bg-red-400/10",
          border: "border-red-400/30",
          icon: <AlertCircle size={14} />,
          label: "Unpaid",
        };
    }
  };

  const status = getStatusConfig();

  return (
    <div className="relative">
      {/* EXPIRED TICKET */}
      {isExpired && (
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10"
        >
          <div className="bg-red-600 text-white px-6 py-2 rounded-full font-bold text-sm shadow-lg flex items-center gap-2 animate-pulse">
            <AlertTriangle size={16} />
            EXPIRED – DELETE
          </div>
        </motion.div>
      )}

      {/* MAIN CARD */}
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`bg-gradient-to-br from-gray-900 to-gray-800 border 
          ${isExpired ? "border-red-500/50 opacity-80" : "border-amber-400/30"} 
          rounded-2xl p-6 shadow-lg hover:shadow-amber-400/10 transition-all duration-300 
          ${isExpired ? "grayscale" : ""}`}
      >
        <div className="flex flex-col lg:flex-row justify-between gap-6">
          {/* LEFT: Booking Details */}
          <div className="flex-1 space-y-4">
            {/* Header: Room + Type */}
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-3 text-amber-300">
                <BedDouble size={22} />
                <span>Room #{roomNumber}</span>
              </h3>
              <span className="text-xs font-medium bg-amber-400/20 text-amber-300 px-3 py-1 rounded-full">
                {roomType}
              </span>
            </div>

            {/* Member */}
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <User size={16} />
              <span>
                Member ID: <span className="font-semibold text-white">{Membership_No}</span>
              </span>
            </div>

            {/* Dates */}
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <CalendarDays size={16} />
              <div>
                <div className="font-medium">
                  {formatDate(checkIn)} → {formatDate(checkOut)}
                </div>
                <div className="text-xs text-gray-400">
                  {formatTime(checkIn)} → {formatTime(checkOut)}
                </div>
              </div>
            </div>

            {/* Pricing Type */}
            <div className="flex items-center gap-2 text-xs">
              <Tag size={14} className="text-amber-400" />
              <span className={`font-medium ${pricingType === "member" ? "text-green-400" : "text-blue-400"}`}>
                {pricingType.toUpperCase()} RATE
              </span>
            </div>

            {/* Total Price */}
            <div className="flex items-center gap-2 text-lg font-bold text-amber-300">
              <span>Rs-{Number(totalPrice).toLocaleString()}</span>
            </div>

            {/* Payment Breakdown */}
            {paymentStatus === "HALF_PAID" && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-green-400/10 border border-green-400/30 rounded-lg p-2 text-center">
                  <div className="text-green-400 font-semibold">Paid</div>
                  <div className="text-white">Rs-{paidAmount}</div>
                </div>
                <div className="bg-red-400/10 border border-red-400/30 rounded-lg p-2 text-center">
                  <div className="text-red-400 font-semibold">Pending</div>
                  <div className="text-white">Rs-{pendingAmount}</div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Status + Actions */}
          <div className="flex flex-col items-end gap-4">
            {/* Status Badge */}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${status.bg} ${status.border} ${status.color} font-semibold text-sm`}>
              {status.icon}
              <span>{status.label}</span>
            </div>

            {/* Booking Time */}
            <div className="text-xs text-gray-400 text-right">
              Booked on {formatDate(createdAt)} at {formatTime(createdAt)}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onEdit}
                className="p-3 rounded-full bg-amber-400/20 hover:bg-amber-400/40 transition-all"
                title="Edit Booking"
              >
                <Pencil size={18} />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onDelete}
                className="p-3 rounded-full bg-red-400/20 hover:bg-red-400/40 transition-all"
                title="Delete Expired Booking"
              >
                <Trash2 size={18} />
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default BookingCard;