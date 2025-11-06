import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getRooms,
  createRoom,
  updateRoom,
  deleteRoom,
  createRoomType,
  getRoomTypes,
} from "../../../config/apis";
import RoomCard from "../cards/RoomCard";
import RoomModal from "../modals/RoomModal";
import RoomTypeModal from "../modals/RoomTypeModal";
import ConfirmModal from "../ui/modals/ConfirmModal";

function Rooms() {
  const queryClient = useQueryClient();
  const { data: rooms = [] } = useQuery({ queryKey: ["rooms"], queryFn: getRooms });
  const { data: roomTypes = [] } = useQuery({ queryKey: ["roomTypes"], queryFn: getRoomTypes });
  const [showModal, setShowModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [error, setError] = useState("");
  const [confirmData, setConfirmData] = useState(null);

  const createMutation = useMutation({
    mutationFn: createRoom,
    onSuccess: async () => {
      await queryClient.invalidateQueries(["rooms"]);
      setShowModal(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateRoom,
    onSuccess: async () => {
      await queryClient.invalidateQueries(["rooms"]);
      setShowModal(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRoom,
    onSuccess: () => {
      queryClient.invalidateQueries(["rooms"]);
      setConfirmData(null);
    },
  });

  const createTypeMutation = useMutation({
    mutationFn: createRoomType,
    onSuccess: async () => {
      await queryClient.invalidateQueries(["roomTypes"]);
      setShowTypeModal(false);
    },
  });

  const handleSubmit = (roomData, isNew) => {
    if (isNew) createMutation.mutate(roomData);
    else updateMutation.mutate(roomData);
  };

  const handleTypeSubmit = (data) => createTypeMutation.mutate(data);

  const handleDelete = (room) => {
    setConfirmData({
      title: "Delete Room",
      message: `Are you sure you want to delete Room #${room.roomNumber}?`,
      onConfirm: () => deleteMutation.mutate(room.id),
    });
  };

  const handleOpenModal = (room = null) => {
    setEditingRoom(room);
    setError("");
    setShowModal(true);
  };

  return (
    <div className="min-h-screen font-sans">
      <div className="flex justify-end items-center mb-10 border-b border-amber-400/50 pb-4 gap-x-3">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => handleOpenModal()}
          className="flex items-center gap-x-1 px-4 py-2 bg-amber-400 text-gray-950 font-bold rounded-full shadow-lg hover:bg-amber-500 transition-colors"
        >
          <Plus size={14} />
          <p className="text-xs font-medium">Add Room</p>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowTypeModal(true)}
          className="flex items-center gap-x-1 px-4 py-2 bg-emerald-400 text-gray-950 font-bold rounded-full shadow-lg hover:bg-emerald-500 transition-colors"
        >
          <Plus size={14} />
          <p className="text-xs font-medium">Create Room Type</p>
        </motion.button>
      </div>

      <div className="space-y-6">
        <AnimatePresence>
          {rooms.length > 0 ? (
            rooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onEdit={() => handleOpenModal(room)}
                onDelete={() => handleDelete(room)}
              />
            ))
          ) : (
            <div className="text-center p-10 rounded-xl border border-amber-400/50">
              <p className="text-lg text-white/70">No rooms found. Add one to begin!</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Room Modal */}
      <AnimatePresence>
        {showModal && (
          <RoomModal
            room={editingRoom}
            onClose={() => setShowModal(false)}
            onSubmit={handleSubmit}
            error={error}
            setError={setError}
            roomTypes={roomTypes}
          />
        )}
      </AnimatePresence>

      {/* Room Type Modal */}
      <AnimatePresence>
        {showTypeModal && (
          <RoomTypeModal
            onClose={() => setShowTypeModal(false)}
            onSubmit={handleTypeSubmit}
          />
        )}
      </AnimatePresence>

      {/* Confirm Delete */}
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

export default Rooms;
