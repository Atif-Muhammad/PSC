import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarPlus, Upload } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getBookings, createBooking, updateBooking, deleteBooking } from "../../../config/apis";
import BookingCard from "../cards/BookingCard";
import BookingModal from "../modals/BookingModal";
import ConfirmModal from "../ui/modals/ConfirmModal";

function Bookings() {
  const queryClient = useQueryClient();

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["bookings"],
    queryFn: getBookings,
  });

  const [showModal, setShowModal] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [error, setError] = useState("");
  const [confirmData, setConfirmData] = useState(null);

  const createMutation = useMutation({
    mutationFn: createBooking,
    onSuccess: async () => {
      await queryClient.invalidateQueries(["bookings"]);
      setShowModal(false);
    },
    onError: (err) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: updateBooking,
    onSuccess: async () => {
      await queryClient.invalidateQueries(["bookings"]);
      setShowModal(false);
    },
    onError: (err) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBooking,
    onSuccess: () => {
      queryClient.invalidateQueries(["bookings"]);
      setConfirmData(null);
    },
    onError: (err) => setError(err.message),
  });

  const handleSubmit = (data, isNew) => {
    console.log(data)
    if (isNew) createMutation.mutate(data);
    else updateMutation.mutate(data);
  };

  const handleDelete = (booking) => {
    setConfirmData({
      title: "Delete Booking",
      message: `Are you sure you want to delete booking for "${booking.room.roomNumber}"?`,
      onConfirm: () => deleteMutation.mutate(booking.id),
    });
  };

  const handleOpenModal = (booking = null) => {
    setEditingBooking(booking);
    setError("");
    setShowModal(true);
  };

  return (
    <div className="min-h-screen font-sans">
      {/* Header */}
      <div className="flex justify-end items-center mb-10 border-b border-amber-400/50 pb-4 gap-x-3">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => handleOpenModal()}
          className="flex items-center gap-x-1 px-4 py-2 bg-amber-400 text-gray-950 font-bold rounded-full shadow-lg hover:bg-amber-500 transition-colors cursor-pointer"
        >
          <CalendarPlus size={14} />
          <p className="text-xs font-medium">Add New Booking</p>
        </motion.button>
      </div>

      {/* Booking Cards */}
      <div className="space-y-6">
        <AnimatePresence>
          {bookings.length > 0 ? (
            bookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onEdit={() => handleOpenModal(booking)}
                onDelete={() => handleDelete(booking)}
              />
            ))
          ) : (
            <div className="text-center p-10  rounded-xl border border-amber-400/50">
              <p className="text-lg font-sm tracking-wider text-white/70">
                No bookings found. Click "Add New Booking" to start!
              </p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <BookingModal
            booking={editingBooking}
            onClose={() => setShowModal(false)}
            onSubmit={handleSubmit}
            error={error}
            setError={setError}
          />
        )}
      </AnimatePresence>

      {/* Confirm */}
      <ConfirmModal
        show={!!confirmData}
        title={confirmData?.title}
        message={confirmData?.message}
        onConfirm={confirmData?.onConfirm}
        onCancel={() => setConfirmData(null)}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}

export default Bookings;
