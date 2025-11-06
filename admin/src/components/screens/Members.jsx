import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserPlus, Upload, Search, Filter, Loader2 } from "lucide-react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMembers, createMember, updateMember, deleteMember, createBulkMembers } from "../../../config/apis";
import MemberCard from "../cards/MemberCard";
import MemberModal from "../modals/MemberModal";
import ConfirmModal from "../ui/modals/ConfirmModal";
import BulkUploadModal from "../modals/BulkUploadModal";
import { useInView } from "react-intersection-observer";

const LazyMemberCard = ({ member, onEdit, onDelete }) => {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
    rootMargin: "200px",
  });

  return (
    <div ref={ref}>
      {inView ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ duration: 0.3 }}
        >
          <MemberCard member={member} onEdit={onEdit} onDelete={onDelete} />
        </motion.div>
      ) : (
        <div className="h-32 rounded-xl animate-pulse" />
      )}
    </div>
  );
};

function Members({ id }) {
  const queryClient = useQueryClient();
  const [searchId, setSearchId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [error, setError] = useState("");
  const [confirmData, setConfirmData] = useState(null);
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Infinite Query
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["members", id, searchId, statusFilter],
    queryFn: getMembers,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasNext ? lastPage.pagination.page + 1 : undefined,
    initialPageParam: 1,
  });

  // Flatten pages
  const members = data?.pages.flatMap((page) => page.data) ?? [];
  const total = data?.pages[0]?.pagination.total ?? 0;

  // Load more on scroll
  const { ref: loadMoreRef } = useInView({
    threshold: 0,
    onChange: (inView) => {
      if (inView && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      setShowModal(false);
    },
    onError: (err) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: updateMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      setShowModal(false);
    },
    onError: (err) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      setConfirmData(null);
    },
    onError: (err) => setError(err.message),
  });

  const handleSubmit = (memberData, isNew) => {
    if (isNew) createMutation.mutate(memberData);
    else updateMutation.mutate(memberData);
  };

  const handleDelete = (member) => {
    setConfirmData({
      title: "Delete Member",
      message: `Delete "${member.Name}" (${member.Email})?`,
      onConfirm: () => deleteMutation.mutate(member.Membership_No),
    });
  };

  const handleOpenModal = (member = null) => {
    setEditingMember(member);
    setError("");
    setShowModal(true);
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => refetch(), 300);
    return () => clearTimeout(timer);
  }, [searchId, statusFilter, refetch]);

  return (
    <div className="min-h-screen font-sans bg-primary-50 p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-4 border-b border-gray-200">
        <h1 className="text-2xl font-light text-gray-50">Members</h1>
        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-gray-950 text-sm font-medium rounded-full hover:bg-amber-600 transition-colors shadow-sm"
          >
            <Upload size={16} />
            Bulk Upload
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => handleOpenModal()}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-400 text-gray-950 text-sm font-medium rounded-full hover:bg-amber-500 transition-colors shadow-sm"
          >
            <UserPlus size={16} />
            Add Member
          </motion.button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search by ID or Name..."
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            className="text-white w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer transition"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="deactivated">Deactivated</option>
            <option value="blocked">Blocked</option>
          </select>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Count */}
      <p className="text-sm text-gray-50/60 mb-4">
        Showing <strong>{members.length}</strong> of <strong>{total}</strong> members
      </p>

      {/* Loading */}
      {isLoading ? (
        <div className="space-y-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 rounded-xl  animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <AnimatePresence>
            {members.length > 0 ? (
              members.map((member) => (
                <LazyMemberCard
                  key={member.Sno}
                  member={member}
                  onEdit={() => handleOpenModal(member)}
                  onDelete={() => handleDelete(member)}
                />
              ))
            ) : (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
                <p className="text-gray-500 text-sm font-light">No members found.</p>
              </div>
            )}
          </AnimatePresence>

          {/* Load More Trigger */}
          {hasNextPage && (
            <div ref={loadMoreRef} className="flex justify-center py-8">
              {isFetchingNextPage ? (
                <Loader2 className="animate-spin text-primary-600" size={24} />
              ) : (
                <div className="h-10" />
              )}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showModal && (
          <MemberModal
            member={editingMember}
            onClose={() => setShowModal(false)}
            onSubmit={handleSubmit}
            error={error}
            setError={setError}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBulkModal && (
          <BulkUploadModal onClose={() => setShowBulkModal(false)} onUpload={createBulkMembers} />
        )}
      </AnimatePresence>

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

export default Members;