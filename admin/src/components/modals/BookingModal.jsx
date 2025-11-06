/* BookingModal.jsx */
import { useState, useCallback, useEffect, useMemo } from "react";
import AsyncSelect from "react-select/async";
import { motion } from "framer-motion";
import {
  X,
  CalendarPlus,
  Users,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import throttle from "lodash/throttle";
import { useQuery } from "@tanstack/react-query";
import {
  searchMembers,
  getRoomTypes,
  getAvailRooms,
  getHallTypes,
  getLawnCategories,
  getLawnCategoriesNames,
} from "../../../config/apis";

const selectStyles = {
  control: (base) => ({
    ...base,
    backgroundColor: "#1a1a1a",
    borderColor: "#333",
    color: "white",
    minHeight: "48px",
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: "#1f1f1f",
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? "#f59e0b"
      : state.isFocused
      ? "#2a2a2a"
      : "#1f1f1f",
    color: state.isSelected ? "black" : "white",
    opacity: state.data.isBooked ? 0.6 : 1,
    cursor: state.data.isBooked ? "not-allowed" : "pointer",
  }),
  singleValue: (base) => ({ ...base, color: "white" }),
  placeholder: (base) => ({ ...base, color: "#888" }),
  input: (base) => ({ ...base, color: "white" }),
};

export default function BookingModal({ onClose, onSubmit, error, setError, booking }) {
  const isEdit = !!booking;

  const [formData, setFormData] = useState({
    membershipNo: booking?.Membership_No || "",
    category: booking?.category || "",
    subCategoryId: booking?.subCategoryId || "",
    entityId: booking?.entityId || "",
    checkIn: booking?.checkIn ? booking.checkIn.split("T")[0] : "",
    checkOut: booking?.checkOut ? booking.checkOut.split("T")[0] : "",
    bookingDate: booking?.bookingDate ? booking.bookingDate.split("T")[0] : "",
    timeSlot: booking?.timeSlot || "",
    photoshootTime: booking?.photoshootTime || "",
    totalPrice: booking?.totalPrice || "",
    paymentStatus: booking?.paymentStatus || "UNPAID",
    pricingType: booking?.pricingType || "member",
    paidAmount: booking?.paidAmount || "",
    pendingAmount: booking?.pendingAmount || "",
  });

  const [searchQuery, setSearchQuery] = useState("");

  /* ==================== MEMBERS ==================== */
  const { data: members = [], isFetching: isLoadingMembers } = useQuery({
    queryKey: ["members", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const { data } = await searchMembers(searchQuery.trim());
      return data.map((m) => ({
        label: `${m.Membership_No} - ${m.Name}`,
        value: m.Membership_No,
        sno: m.Sno,
      }));
    },
    enabled: !!searchQuery,
    staleTime: 60_000,
    cacheTime: 300_000,
  });

  const loadMembers = useCallback(
    throttle((input, cb) => {
      setSearchQuery(input);
      const filtered = members.filter((o) =>
        o.label.toLowerCase().includes(input.toLowerCase())
      );
      cb(filtered);
    }, 900),
    [members]
  );

  /* ==================== ROOM ==================== */
  const { data: roomTypes = [], isFetching: loadingRoomTypes } = useQuery({
    queryKey: ["roomTypes"],
    queryFn: async () => {
      const { data } = await getRoomTypes();
      return data.map((x) => ({
        label: x.type || x.name || "Unnamed",
        value: x.id,
      }));
    },
    enabled: formData.category === "Room",
  });

  const { data: availableRoomsRaw = [], isFetching: loadingRooms } = useQuery({
    queryKey: ["availableRooms", formData.subCategoryId],
    queryFn: async () => {
      if (!formData.subCategoryId) return [];
      const { data } = await getAvailRooms(formData.subCategoryId);
      return data;
    },
    enabled: formData.category === "Room" && !!formData.subCategoryId,
  });

  const availableRooms = useMemo(() => {
    return availableRoomsRaw.map((r) => ({
      label: r.roomNumber || r.description || "Unnamed",
      value: r.id,
      priceMember: Number(r.roomType.priceMember),
      priceGuest: Number(r.roomType.priceGuest),
      isBooked: r.isBooked,
    }));
  }, [availableRoomsRaw]);

  /* ==================== HALL ==================== */
  const { data: hallTypesRaw = [], isFetching: loadingHallTypes } = useQuery({
    queryKey: ["hallTypes"],
    queryFn: async () => {
      const { data } = await getHallTypes();
      return data;
    },
    enabled: formData.category === "Hall",
  });

  const hallTypes = useMemo(() => {
    return hallTypesRaw.map((h) => ({
      label: h.name,
      value: h.id,
      priceMember: Number(h.chargesMembers),
      priceGuest: Number(h.chargesGuests),
      capacity: h.capacity,
      isBooked: h.isBooked,
      isConference: h.name.toLowerCase().includes("conference"),
    }));
  }, [hallTypesRaw]);

  /* ==================== LAWN ==================== */
  const { data: lawnTypes = [], isFetching: loadingLawnTypes } = useQuery({
    queryKey: ["lawnTypes"],
    queryFn: async () => {
      const { data } = await getLawnCategories();
      return data.map((x) => ({
        label: x.category || x.name || "Unnamed",
        value: x.id,
      }));
    },
    enabled: formData.category === "Lawn",
  });

  const {
    data: availableLawnsRaw = [],
    isFetching: loadingLawns,
    error: lawnError,
  } = useQuery({
    queryKey: ["availableLawns", formData.subCategoryId],
    queryFn: async () => {
      if (!formData.subCategoryId) return [];
      const { data } = await getLawnCategoriesNames(formData.subCategoryId);
      return data;
    },
    enabled: formData.category === "Lawn" && !!formData.subCategoryId,
    onError: (e) => setError(e.message || "Failed to load lawns"),
  });

  const availableLawns = useMemo(() => {
    return availableLawnsRaw.map((l) => ({
      label: l.description || `Lawn ${l.id}`,
      value: l.id,
      minGuests: l.minGuests,
      maxGuests: l.maxGuests,
      priceMember: Number(l.memberCharges),
      priceGuest: Number(l.guestCharges),
      isBooked: l.isBooked,
    }));
  }, [availableLawnsRaw]);

  const formatLawnOption = (opt) => {
    const { minGuests, maxGuests, priceMember, isBooked } = opt;
    return (
      <div className="flex items-center justify-between py-1">
        <div>
          <div className="font-medium">{opt.label}</div>
          <div className="text-xs text-gray-400 flex items-center gap-2">
            <Users size={12} /> {minGuests}–{maxGuests} guests
            <DollarSign size={12} /> Rs-{priceMember.toLocaleString()}
          </div>
        </div>
        {isBooked ? (
          <XCircle size={16} className="text-red-500" title="Booked" />
        ) : (
          <CheckCircle size={16} className="text-green-500" title="Available" />
        )}
      </div>
    );
  };

  /* ==================== SUB-CATEGORY ==================== */
  const loadSubCategories = useCallback(() => {
    switch (formData.category) {
      case "Room": return roomTypes;
      case "Hall": return hallTypes;
      case "Lawn": return lawnTypes;
      default: return [];
    }
  }, [formData.category, roomTypes, hallTypes, lawnTypes]);

  const isLoadingSub = loadingRoomTypes || loadingHallTypes || loadingLawnTypes;

  /* ==================== ENTITY ==================== */
  const loadEntities = useCallback(() => {
    if (formData.category === "Room" && formData.subCategoryId) return availableRooms;
    if (formData.category === "Lawn" && formData.subCategoryId) return availableLawns;
    return [];
  }, [formData.category, formData.subCategoryId, availableRooms, availableLawns]);

  const isLoadingEntity = loadingRooms || loadingLawns;

  /* ==================== CONFERENCE HALL LOGIC ==================== */
  const isConferenceHall = useMemo(() => {
    if (formData.category !== "Hall" || !formData.subCategoryId) return false;
    const hall = hallTypes.find((h) => h.value === formData.subCategoryId);
    return hall?.isConference || false;
  }, [formData.category, formData.subCategoryId, hallTypes]);

  useEffect(() => {
    if (isConferenceHall && formData.pricingType !== "member") {
      setFormData((prev) => ({ ...prev, pricingType: "member", totalPrice: "" }));
    }
  }, [isConferenceHall]);

  /* ==================== PRICE CALCULATION ==================== */
  useEffect(() => {
    if (!formData.category) {
      setFormData((prev) => ({ ...prev, totalPrice: "" }));
      return;
    }
    let price = 0;
    const isMember = formData.pricingType === "member";
    if (formData.category === "Photoshoot") {
      if (formData.bookingDate && formData.photoshootTime) {
        price = isMember ? 15000 : 20000;
      }
    } else if (formData.category === "Room") {
      if (!formData.checkIn || !formData.checkOut) return;
      const checkIn = new Date(formData.checkIn);
      const checkOut = new Date(formData.checkOut);
      if (checkOut <= checkIn) return;
      const days = Math.ceil((checkOut - checkIn) / 86_400_000);
      const room = availableRoomsRaw.find((r) => r.id === formData.entityId);
      const pricePerDay = room ? Number(isMember ? room.roomType.priceMember : room.roomType.priceGuest) : 0;
      price = pricePerDay * days;
    } else if (["Lawn", "Hall"].includes(formData.category)) {
      if (!formData.bookingDate || !formData.timeSlot) return;
      let basePrice = 0;
      if (formData.category === "Lawn" && formData.entityId) {
        const lawn = availableLawnsRaw.find((l) => l.id === formData.entityId);
        basePrice = lawn ? Number(isMember ? lawn.memberCharges : lawn.guestCharges) : 0;
      } else if (formData.category === "Hall" && formData.subCategoryId) {
        const hall = hallTypesRaw.find((h) => h.id === formData.subCategoryId);
        basePrice = hall ? Number(isMember ? hall.chargesMembers : hall.chargesGuests) : 0;
      }
      const multiplier = formData.timeSlot === "morning" ? 0.5 : formData.timeSlot === "evening" ? 0.75 : 1;
      price = basePrice * multiplier;
    }
    const total = price.toFixed(2);
    setFormData((prev) => {
      const newPaid = prev.paymentStatus === "HALF_PAID" && prev.paidAmount ? prev.paidAmount : "";
      const pending = total && newPaid ? (total - newPaid).toFixed(2) : "";
      return { ...prev, totalPrice: total, paidAmount: newPaid, pendingAmount: pending };
    });
  }, [
    formData.category,
    formData.checkIn,
    formData.checkOut,
    formData.bookingDate,
    formData.timeSlot,
    formData.photoshootTime,
    formData.entityId,
    formData.subCategoryId,
    formData.pricingType,
    availableRoomsRaw,
    availableLawnsRaw,
    hallTypesRaw,
  ]);

  /* ==================== PAID AMOUNT LOGIC ==================== */
  const handlePaidAmountChange = (e) => {
    const value = e.target.value.replace(/[^0-9.]/g, "");
    const total = parseFloat(formData.totalPrice) || 0;
    const paid = parseFloat(value) || 0;
    if (paid > total) {
      setError("Paid amount cannot exceed total price.");
      return;
    } else {
      setError("");
    }
    const pending = (total - paid).toFixed(2);
    setFormData((prev) => ({
      ...prev,
      paidAmount: value,
      pendingAmount: paid === total ? "0.00" : pending,
    }));
  };

  useEffect(() => {
    if (formData.paymentStatus !== "HALF_PAID") {
      setFormData((prev) => ({ ...prev, paidAmount: "", pendingAmount: "" }));
    }
  }, [formData.paymentStatus]);

  /* ==================== HANDLERS ==================== */
  const handleCategoryChange = (value) => {
    setFormData((prev) => ({
      ...prev,
      category: value,
      subCategoryId: "",
      entityId: "",
      checkIn: "",
      checkOut: "",
      bookingDate: "",
      timeSlot: "",
      photoshootTime: "",
      totalPrice: "",
      pricingType: "member",
      paidAmount: "",
      pendingAmount: "",
    }));
  };

  const handleMemberChange = (opt) => {
    setFormData((prev) => ({ ...prev, membershipNo: opt ? opt.value : "" }));
  };

  const handleSubCategoryChange = (opt) => {
    setFormData((prev) => ({
      ...prev,
      subCategoryId: opt ? opt.value : "",
      entityId: "",
      totalPrice: "",
    }));
  };

  const handleEntityChange = (opt) => {
    if (opt && !opt.isBooked) {
      setFormData((prev) => ({
        ...prev,
        entityId: opt.value,
        totalPrice: "",
      }));
    }
  };

  const handlePricingTypeChange = (type) => {
    if (isConferenceHall && type === "guest") return;
    setFormData((prev) => ({ ...prev, pricingType: type, totalPrice: "" }));
  };

  const handlePaymentStatusChange = (status) => {
    setFormData((prev) => ({
      ...prev,
      paymentStatus: status,
      paidAmount: status === "PAID" ? prev.totalPrice : "",
      pendingAmount: status === "PAID" ? "0.00" : "",
    }));
  };

  const handleCheckInChange = (e) => {
    const value = e.target.value;
    setFormData((prev) => ({
      ...prev,
      checkIn: value,
      checkOut: prev.checkOut && new Date(prev.checkOut) < new Date(value) ? "" : prev.checkOut,
      totalPrice: "",
    }));
  };

  const handleCheckOutChange = (e) => {
    setFormData((prev) => ({ ...prev, checkOut: e.target.value, totalPrice: "" }));
  };

  const handleBookingDateChange = (e) => {
    setFormData((prev) => ({ ...prev, bookingDate: e.target.value, totalPrice: "" }));
  };

  const handleTimeSlotChange = (slot) => {
    setFormData((prev) => ({ ...prev, timeSlot: slot, totalPrice: "" }));
  };

  const handlePhotoshootTimeChange = (e) => {
    setFormData((prev) => ({ ...prev, photoshootTime: e.target.value, totalPrice: "" }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    const required = [formData.membershipNo, formData.category];
    if (formData.category === "Room") {
      required.push(formData.subCategoryId, formData.entityId, formData.checkIn, formData.checkOut);
    } else if (["Lawn", "Hall"].includes(formData.category)) {
      required.push(formData.subCategoryId, formData.bookingDate, formData.timeSlot);
      if (formData.category === "Lawn") required.push(formData.entityId);
    } else if (formData.category === "Photoshoot") {
      required.push(formData.bookingDate, formData.photoshootTime);
    }
    if (formData.paymentStatus === "HALF_PAID" && !formData.paidAmount) {
      setError("Please enter paid amount for half-paid booking.");
      return;
    }
    if (required.some((x) => !x)) {
      setError("Please fill all required fields.");
      return;
    }
    const payload = {
      id: isEdit ? booking.id : undefined,
      membershipNo: formData.membershipNo,
      category: formData.category,
      subCategoryId: formData.subCategoryId || null,
      entityId: formData.entityId || null,
      checkIn: formData.checkIn || null,
      checkOut: formData.checkOut || null,
      bookingDate: formData.bookingDate || null,
      timeSlot: formData.timeSlot || null,
      photoshootTime: formData.photoshootTime || null,
      totalPrice: formData.totalPrice,
      paymentStatus: formData.paymentStatus,
      pricingType: formData.pricingType,
      paidAmount: formData.paidAmount || 0.00,
      pendingAmount: formData.pendingAmount || 0.00,
    };
    onSubmit(payload, !isEdit);
  };

  /* ==================== PRESELECT VALUES ==================== */
  const selectedMember = useMemo(
    () => members.find(m => m.value === formData.membershipNo) || null,
    [members, formData.membershipNo]
  );

  const selectedSubCategory = useMemo(
    () => loadSubCategories().find(s => s.value === formData.subCategoryId) || null,
    [loadSubCategories, formData.subCategoryId]
  );

  const selectedEntity = useMemo(
    () => loadEntities().find(e => e.value === formData.entityId) || null,
    [loadEntities, formData.entityId]
  );

  /* ==================== UI ==================== */
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <motion.div
        className="bg-gray-900 border border-amber-400/30 rounded-xl w-full max-w-5xl max-h-[85vh] flex flex-col"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
      >
        {/* Header */}
        <div className="p-4 flex justify-between items-center border-b border-amber-400/20 bg-gray-900">
          <h2 className="text-2xl text-amber-400 font-bold flex items-center gap-2">
            <CalendarPlus size={20} /> {isEdit ? "Edit" : "New"} Booking
          </h2>
          <button onClick={onClose} className="text-amber-300 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ROW 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-amber-400 text-sm font-medium mb-1 block">
                Member <span className="text-red-500">*</span>
              </label>
              <AsyncSelect
                cacheOptions
                loadOptions={loadMembers}
                onChange={handleMemberChange}
                placeholder="Search member..."
                styles={selectStyles}
                isClearable
                isLoading={isLoadingMembers}
                value={selectedMember}
                noOptionsMessage={() =>
                  searchQuery ? "No members found" : "Type to search..."
                }
              />
            </div>
            <div>
              <label className="text-amber-400 text-sm font-medium mb-1 block">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                className="bg-gray-800 text-white w-full p-3 rounded-md border border-gray-700 focus:border-amber-400 focus:outline-none"
                value={formData.category}
                onChange={(e) => handleCategoryChange(e.target.value)}
              >
                <option value="">Select Category</option>
                <option value="Room">Room</option>
                <option value="Hall">Hall</option>
                <option value="Lawn">Lawn</option>
                <option value="Photoshoot">Photoshoot</option>
              </select>
            </div>
          </div>

          {/* ROW 2: Subcategory + Entity */}
          {["Room", "Hall", "Lawn"].includes(formData.category) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-amber-400 text-sm font-medium mb-1 block">
                  {formData.category} Type <span className="text-red-500">*</span>
                </label>
                <AsyncSelect
                  cacheOptions
                  defaultOptions={loadSubCategories()}
                  loadOptions={() => Promise.resolve(loadSubCategories())}
                  onChange={handleSubCategoryChange}
                  placeholder="Select type..."
                  styles={selectStyles}
                  isLoading={isLoadingSub}
                  isDisabled={isLoadingSub}
                  isClearable
                  value={selectedSubCategory}
                />
              </div>
              {["Room", "Lawn"].includes(formData.category) &&
                formData.subCategoryId && (
                  <div>
                    <label className="text-amber-400 text-sm font-medium mb-1 block">
                      Available {formData.category} <span className="text-red-500">*</span>
                    </label>
                    <AsyncSelect
                      cacheOptions
                      defaultOptions={loadEntities()}
                      loadOptions={() => Promise.resolve(loadEntities())}
                      onChange={handleEntityChange}
                      placeholder="Select available..."
                      styles={selectStyles}
                      isLoading={isLoadingEntity}
                      isDisabled={isLoadingEntity}
                      isClearable
                      formatOptionLabel={
                        formData.category === "Lawn" ? formatLawnOption : undefined
                      }
                      isOptionDisabled={(opt) => opt.isBooked}
                      value={selectedEntity}
                    />
                  </div>
                )}
            </div>
          )}

          {/* ROW 3: Date Logic */}
          {formData.category === "Room" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-amber-400 text-sm font-medium mb-1 block">
                  Check-In <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  className="bg-gray-800 text-white w-full p-3 rounded-md border border-gray-700 focus:border-amber-400 focus:outline-none"
                  min={new Date().toISOString().split("T")[0]}
                  value={formData.checkIn}
                  onChange={handleCheckInChange}
                />
              </div>
              <div>
                <label className="text-amber-400 text-sm font-medium mb-1 block">
                  Check-Out <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  className="bg-gray-800 text-white w-full p-3 rounded-md border border-gray-700 focus:border-amber-400 focus:outline-none"
                  min={formData.checkIn || new Date().toISOString().split("T")[0]}
                  value={formData.checkOut}
                  onChange={handleCheckOutChange}
                />
              </div>
            </div>
          ) : ["Lawn", "Hall", "Photoshoot"].includes(formData.category) ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-amber-400 text-sm font-medium mb-1 block">
                  Booking Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  className="bg-gray-800 text-white w-full p-3 rounded-md border border-gray-700 focus:border-amber-400 focus:outline-none"
                  min={new Date().toISOString().split("T")[0]}
                  value={formData.bookingDate}
                  onChange={handleBookingDateChange}
                />
              </div>
              {formData.category === "Photoshoot" ? (
                <div>
                  <label className="text-amber-400 text-sm font-medium mb-1 block">
                    Time <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="time"
                      className="bg-gray-800 text-white w-full p-3 rounded-md border border-gray-700 focus:border-amber-400 focus:outline-none pr-10"
                      value={formData.photoshootTime}
                      onChange={handlePhotoshootTimeChange}
                    />
                    <Clock className="absolute right-3 top-3.5 text-gray-400" size={18} />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-amber-400 text-sm font-medium mb-1 block">
                    Time Slot <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    {["morning", "evening", "night"].map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => handleTimeSlotChange(slot)}
                        className={`flex-1 py-3 px-4 rounded-lg font-medium capitalize transition ${
                          formData.timeSlot === slot
                            ? "bg-amber-400 text-black"
                            : "bg-gray-800 text-white hover:bg-gray-700"
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* ROW 4: Pricing Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-amber-400 text-sm font-medium mb-1 block">
                Pricing Type
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handlePricingTypeChange("member")}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition ${
                    formData.pricingType === "member"
                      ? "bg-amber-400 text-black"
                      : "bg-gray-800 text-white hover:bg-gray-700"
                  }`}
                >
                  {formData.category === "Photoshoot" ? "Member (Rs-15,000)" : "Member"}
                </button>
                <button
                  type="button"
                  onClick={() => handlePricingTypeChange("guest")}
                  disabled={isConferenceHall}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition ${
                    formData.pricingType === "guest"
                      ? "bg-amber-400 text-black"
                      : isConferenceHall
                      ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                      : "bg-gray-800 text-white hover:bg-gray-700"
                  }`}
                >
                  {formData.category === "Photoshoot"
                    ? "Guest (Rs-20,000)"
                    : isConferenceHall
                    ? "Guest (Members Only)"
                    : "Guest"}
                </button>
              </div>
            </div>
            <div>
              <label className="text-amber-400 text-sm font-medium mb-1 block">
                Payment Status
              </label>
              <div className="flex gap-2">
                {["UNPAID", "HALF_PAID", "PAID"].map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => handlePaymentStatusChange(status)}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition ${
                      formData.paymentStatus === status
                        ? "bg-amber-400 text-black"
                        : "bg-gray-800 text-white hover:bg-gray-700"
                    }`}
                  >
                    {status.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* HALF PAID INPUT */}
          {formData.paymentStatus === "HALF_PAID" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-amber-400 text-sm font-medium mb-1 block">
                  Paid Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="bg-gray-800 text-white w-full p-3 rounded-md border border-gray-700 focus:border-amber-400 focus:outline-none"
                  placeholder="Enter amount"
                  value={formData.paidAmount}
                  onChange={handlePaidAmountChange}
                />
              </div>
              <div>
                <label className="text-amber-400 text-sm font-medium mb-1 block">
                  Pending Amount
                </label>
                <input
                  type="text"
                  className="bg-gray-800 text-white w-full p-3 rounded-md border border-gray-700"
                  value={formData.pendingAmount ? `Rs-${formData.pendingAmount}` : ""}
                  readOnly
                />
              </div>
              <div>
                <label className="text-amber-400 text-sm font-medium mb-1 block">
                  Total Amount
                </label>
                <input
                  type="text"
                  className="bg-gray-800 text-white w-full p-3 rounded-md border border-gray-700"
                  value={formData.totalPrice ? `Rs-${formData.totalPrice}` : ""}
                  readOnly
                />
              </div>
            </div>
          )}

          {/* NORMAL PRICE DISPLAY */}
          {formData.paymentStatus !== "HALF_PAID" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div />
              <div>
                <label className="text-amber-400 text-sm font-medium mb-1 block">
                  Total Price
                </label>
                <input
                  type="text"
                  className="bg-gray-800 text-white w-full p-3 rounded-md border border-gray-700"
                  value={formData.totalPrice ? `Rs-${formData.totalPrice}` : ""}
                  readOnly
                  placeholder="Auto-calculated..."
                />
              </div>
            </div>
          )}

          {/* Error */}
          {(error || lawnError) && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-400 text-sm col-span-2"
            >
              {error || lawnError?.message}
            </motion.p>
          )}
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-amber-400/20 bg-gray-900 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-gray-700 text-white rounded-full hover:bg-gray-600"
          >
            Cancel
          </button>
          <motion.button
            type="submit"
            onClick={handleSubmit}
            disabled={!formData.totalPrice || (formData.paymentStatus === "HALF_PAID" && !formData.paidAmount)}
            className="px-6 py-2.5 bg-amber-400 text-black rounded-full font-semibold hover:bg-amber-500 shadow-md disabled:opacity-50"
            whileTap={{ scale: 0.95 }}
          >
            {isEdit ? "Update" : "Create"} Booking
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}