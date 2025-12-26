
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, XCircle, Loader2, Receipt, User, NotepadText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getBookings,
  createBooking,
  updateBooking,
  deleteBooking,
  getHalls,
  searchMembers,
  getVouchers,
} from "../../config/apis";
import { Member, Voucher } from "@/types/room-booking.type";
import {
  Hall,
  HallBooking,
  HallBookingForm,
  HallBookingTime,
  PaymentStatus,
  PricingType,
} from "@/types/hall-booking.type";
import {
  calculateHallAccountingValues,
  getAvailableTimeSlots,
  checkHallConflicts,
  hallInitialFormState,
  calculateHallPrice,
  parseLocalDate,
} from "@/utils/hallBookingUtils";
import { MemberSearchComponent } from "@/components/MemberSearch";
import { FormInput } from "@/components/FormInputs";
import { UnifiedDatePicker } from "@/components/UnifiedDatePicker";
import { format, differenceInCalendarDays, addDays } from "date-fns";
import { HallBookingDetailsCard } from "@/components/details/HallBookingDets";


// Payment section built for hall bookings
const HallPaymentSection = React.memo(
  ({
    form,
    onChange,
  }: {
    form: HallBookingForm;
    onChange: (field: keyof HallBookingForm, value: any) => void;
  }) => {
    const accounting = calculateHallAccountingValues(
      form.paymentStatus as PaymentStatus,
      form.totalPrice,
      form.paidAmount
    );

    return (
      <div className="md:col-span-2 border-t pt-4">
        <Label className="text-lg font-semibold">Payment Details</Label>

        <div className="mt-4">
          <Label>Total Amount</Label>
          <Input
            type="text"
            className="mt-2 font-bold text-lg"
            value={`PKR ${form.totalPrice.toLocaleString()}`}
            disabled
          />
        </div>

        <div className="mt-4">
          <Label>Payment Status</Label>
          <Select
            value={form.paymentStatus}
            onValueChange={(val) => onChange("paymentStatus", val)}
          >
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UNPAID">Unpaid</SelectItem>
              <SelectItem value="HALF_PAID">Half Paid</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="TO_BILL">To Bill</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {form.paymentStatus === "TO_BILL" && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-center">
              <Receipt className="h-4 w-4 text-blue-600 mr-2" />
              <span className="text-sm font-medium text-blue-800">
                Remaining amount will be added to Member's Ledger/Balance
              </span>
            </div>
          </div>
        )}

        {form.paymentStatus === "HALF_PAID" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <Label>Paid Amount (PKR) *</Label>
              <Input
                type="number"
                value={form.paidAmount || ""}
                onChange={(e) =>
                  onChange("paidAmount", parseFloat(e.target.value) || 0)
                }
                className="mt-2"
                placeholder="Enter paid amount"
                min="0"
                max={form.totalPrice}
              />
            </div>
            <div>
              <Label>Pending Amount (PKR)</Label>
              <Input
                type="number"
                value={form.pendingAmount}
                className="mt-2"
                readOnly
                disabled
              />
            </div>
          </div>
        )}

        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <Label className="text-lg font-semibold text-blue-800">
            Accounting Summary
          </Label>
          <div className="grid grid-cols-2 gap-2 text-sm mt-2">
            <div className="text-blue-700">Total Amount:</div>
            <div className="font-semibold text-right text-blue-700">
              PKR {form.totalPrice.toLocaleString()}
            </div>

            <div className="text-green-700">Paid Amount (DR):</div>
            <div className="font-semibold text-right text-green-700">
              PKR {accounting.paid.toLocaleString()}
            </div>

            <div className="text-red-700">Owed Amount (CR):</div>
            <div className="font-semibold text-right text-red-700">
              PKR {accounting.owed.toLocaleString()}
            </div>
          </div>
          <div className="mt-2 text-xs text-blue-600">
            <strong>DR</strong> = Debit (Amount Received), <strong>CR</strong> =
            Credit (Amount Owed)
          </div>
        </div>

        {(form.paymentStatus === "PAID" ||
          form.paymentStatus === "HALF_PAID") && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center">
                <Receipt className="h-4 w-4 text-green-600 mr-2" />
                <span className="text-sm font-medium text-green-800">
                  {form.paymentStatus === "PAID"
                    ? "Full Payment Voucher will be generated automatically"
                    : "Half Payment Voucher will be generated automatically"}
                </span>
              </div>
            </div>
          )}
      </div>
    );
  }
);

HallPaymentSection.displayName = "HallPaymentSection";

const IndividualTimeSlotSelector = ({
  bookingDetails,
  hallId,
  bookings,
  halls,
  reservations,
  onChange,
  editBookingId,
  defaultEventType
}: {
  bookingDetails: { date: string; timeSlot: string; eventType?: string }[];
  hallId: string;
  bookings: HallBooking[];
  halls: Hall[];
  reservations: any[];
  onChange: (newDetails: { date: string; timeSlot: string; eventType?: string }[]) => void;
  editBookingId?: string;
  defaultEventType?: string;
}) => {
  if (!bookingDetails) return null;

  // Group details by date for easier UI rendering
  const dates = Array.from(new Set(bookingDetails.map(d => d.date))).sort();

  const toggleSlot = (date: string, slot: string) => {
    const existingIndex = bookingDetails.findIndex(d => d.date === date && d.timeSlot === slot);
    let newDetails = [...bookingDetails];

    if (existingIndex > -1) {
      // Don't allow removing the last slot for this date - at least one must remain
      const slotsForThisDay = bookingDetails.filter(d => d.date === date);
      if (slotsForThisDay.length <= 1) {
        // This is the last slot for this day, don't remove it
        return;
      }
      newDetails.splice(existingIndex, 1);
    } else {
      // Find default event type for this day or from others
      const sameDayDetail = bookingDetails.find(d => d.date === date);
      newDetails.push({
        date,
        timeSlot: slot,
        eventType: sameDayDetail?.eventType || defaultEventType || "wedding"
      });
    }
    onChange(newDetails.sort((a, b) => a.date.localeCompare(b.date)));
  };

  const updateEventType = (date: string, slot: string, type: string) => {
    const newDetails = bookingDetails.map(d =>
      (d.date === date && d.timeSlot === slot) ? { ...d, eventType: type } : d
    );
    onChange(newDetails);
  };

  const eventTypes = [
    { value: "mehandi", label: "Mehandi" },
    { value: "barat", label: "Barat" },
    { value: "walima", label: "Walima" },
    { value: "birthday", label: "Birthday" },
    { value: "corporate", label: "Corporate" },
    { value: "wedding", label: "Wedding" },
    { value: "other", label: "Other" },
  ];

  return (
    <div className="col-span-full mt-2 space-y-4 p-4 bg-muted/10 rounded-xl border border-muted/30">
      <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
        <NotepadText className="h-4 w-4 text-blue-500" />
        Booking Schedule & Time Slots
      </h4>
      <div className="space-y-4">
        {dates.map((dateStr) => {
          const date = parseLocalDate(dateStr);
          const dayDetails = bookingDetails.filter(d => d.date === dateStr);

          const otherBookings = editBookingId
            ? bookings.filter(b => b.id?.toString() !== editBookingId?.toString())
            : bookings;

          const availableSlots = getAvailableTimeSlots(
            hallId,
            dateStr,
            otherBookings,
            halls,
            reservations
          );

          return (
            <div key={dateStr} className="p-3 bg-background rounded-lg border shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-foreground">
                  {format(date, "EEEE, MMMM do")}
                </span>
                <div className="flex gap-1">
                  {["MORNING", "EVENING", "NIGHT"].map(slot => {
                    const isActive = dayDetails.some(d => d.timeSlot === slot);
                    const isAvailable = availableSlots.includes(slot) || isActive;

                    return (
                      <Button
                        key={slot}
                        type="button"
                        variant={isActive ? "default" : "outline"}
                        size="sm"
                        className={`text-[10px] h-7 px-2 uppercase font-bold tracking-tighter ${!isAvailable ? "opacity-40 cursor-not-allowed" : ""
                          }`}
                        disabled={!isAvailable}
                        onClick={() => toggleSlot(dateStr, slot)}
                      >
                        {slot.charAt(0)}{slot.slice(1).toLowerCase()}
                        {!isAvailable && " (X)"}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {dayDetails.length > 0 && (
                <div className="space-y-2 pl-2 border-l-2 border-blue-100">
                  {dayDetails.map((detail, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 min-w-[80px]">
                        <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold uppercase">
                          {detail.timeSlot}
                        </span>
                      </div>
                      <Select
                        value={detail.eventType}
                        onValueChange={(val) => updateEventType(dateStr, detail.timeSlot, val)}
                      >
                        <SelectTrigger className="h-8 text-xs bg-muted/20 border-none w-[140px]">
                          <SelectValue placeholder="Event Type" />
                        </SelectTrigger>
                        <SelectContent>
                          {eventTypes.map(t => (
                            <SelectItem key={t.value} value={t.value} className="text-xs">
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}

              {dayDetails.length === 0 && (
                <p className="text-[10px] text-muted-foreground italic pl-2">
                  No slots selected for this day. Click buttons above to add.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function HallBookings() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editBooking, setEditBooking] = useState<HallBooking | null>(null);
  const [cancelBooking, setCancelBooking] = useState<HallBooking | null>(null);
  const [viewVouchers, setViewVouchers] = useState<HallBooking | null>(null);
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [form, setForm] = useState<HallBookingForm>(hallInitialFormState);
  const [editForm, setEditForm] = useState<HallBookingForm>(hallInitialFormState);
  const [availableHalls, setAvailableHalls] = useState<Hall[]>([]);

  // Member search states for create dialog
  const [memberSearch, setMemberSearch] = useState("");
  const [showMemberResults, setShowMemberResults] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const [detailBooking, setDetailBooking] = useState<HallBooking | null>(null);
  const [openDetails, setOpenDetails] = useState(false)


  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // API Queries
  const { data: bookings = [], isLoading: isLoadingBookings } = useQuery<HallBooking[]>({
    queryKey: ["bookings", "halls"],
    queryFn: async () => (await getBookings("halls")) as HallBooking[],
  });

  const { data: halls = [], isLoading: isLoadingHalls } = useQuery<Hall[]>({
    queryKey: ["halls"],
    queryFn: async () => (await getHalls()) as Hall[],
  });


  // Member search query with throttling for create dialog
  const {
    data: searchResults = [],
    isLoading: isSearching,
    refetch: searchMembersFn,
  } = useQuery<Member[]>({
    queryKey: ["memberSearch", memberSearch],
    queryFn: async () => (await searchMembers(memberSearch)) as Member[],
    enabled: false,
  });

  const {
    data: vouchers = [],
    isLoading: isLoadingVouchers,
  } = useQuery<Voucher[]>({
    queryKey: ["hall-vouchers", viewVouchers?.id],
    queryFn: () => (viewVouchers ? getVouchers("HALL", viewVouchers.id) : []),
    enabled: !!viewVouchers,
  });

  // Derive reservations from halls
  const reservations = useMemo(() => {
    return halls.flatMap((hall: any) => hall.reservations || []);
  }, [halls]);

  // Get available time slots for the selected date in create form
  const availableCreateTimeSlots = useMemo(
    () => getAvailableTimeSlots(form.hallId, form.bookingDate, bookings, halls, reservations),
    [form.hallId, form.bookingDate, bookings, halls, reservations]
  );

  // Get available time slots for the selected date in edit form
  const availableEditTimeSlots = useMemo(() => {
    if (!editForm.hallId || !editForm.bookingDate) return [];

    // Filter out the current booking being edited so its own time slot isn't marked as unavailable
    const otherBookings = bookings.filter(b => b.id?.toString() !== editBooking?.id?.toString());

    return getAvailableTimeSlots(
      editForm.hallId,
      editForm.bookingDate,
      otherBookings,
      halls,
      reservations
    );
  }, [editForm.hallId, editForm.bookingDate, bookings, halls, editBooking, reservations]);

  // Stable search handler with proper cleanup
  const handleMemberSearch = useCallback(
    (searchTerm: string) => {
      setMemberSearch(searchTerm);

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = setTimeout(() => {
        if (searchTerm.trim().length >= 2) {
          searchMembersFn();
          setShowMemberResults(true);
        } else {
          setShowMemberResults(false);
        }
      }, 300);
    },
    [searchMembersFn]
  );

  // Stable focus handler
  const handleSearchFocus = useCallback(() => {
    if (memberSearch.length >= 2 && searchResults.length > 0) {
      setShowMemberResults(true);
    }
  }, [memberSearch.length, searchResults.length]);

  // Stable member selection handlers
  const handleSelectMember = useCallback((member: Member) => {
    setSelectedMember(member);
    setForm((prev) => ({
      ...prev,
      membershipNo: member.Membership_No || member.membershipNumber || "",
      memberName: member.Name,
      memberId: member.id?.toString(),
    }));
    setMemberSearch("");
    setShowMemberResults(false);
  }, []);

  const handleClearMember = useCallback(() => {
    setSelectedMember(null);
    setForm((prev) => ({
      ...prev,
      membershipNo: "",
      memberName: "",
      memberId: "",
    }));
    setMemberSearch("");
    setShowMemberResults(false);
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Filter available halls
  useEffect(() => {
    // Show all active halls that are not out of service
    // Don't filter by isBooked since a hall can have multiple time slots per day
    const filteredHalls = halls.filter(
      (hall: Hall) => hall.isActive && !hall.isOutOfService
    );
    setAvailableHalls(filteredHalls);
  }, [halls]);

  // Mutations
  const createMutation = useMutation<any, Error, Record<string, any>>({
    mutationFn: (payload) => createBooking(payload),
    onSuccess: () => {
      toast({ title: "Hall booking created successfully" });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      setIsAddOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create hall booking",
        description: error?.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation<any, Error, Record<string, any>>({
    mutationFn: (payload) => updateBooking(payload),
    onSuccess: () => {
      toast({ title: "Hall booking updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      setEditBooking(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update hall booking",
        description: error?.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation<any, Error, { bookingFor: string; bookID: string }>({
    mutationFn: ({ bookingFor, bookID }) => deleteBooking(bookingFor, bookID),
    onSuccess: () => {
      toast({ title: "Hall booking cancelled successfully" });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      setCancelBooking(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to cancel hall booking",
        description: error?.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const createFormChangeHandler = (isEdit: boolean) => {
    return (field: keyof HallBookingForm, value: any) => {
      const setFormFn = isEdit ? setEditForm : setForm;

      setFormFn((prev) => {
        const newForm = { ...prev, [field]: value };

        // Handle hall price recalculation
        if (["hallId", "pricingType", "bookingDate", "endDate"].includes(field as string)) {
          newForm.totalPrice = calculateHallPrice(
            halls,
            field === "hallId" ? value : newForm.hallId,
            field === "pricingType" ? value : newForm.pricingType,
            newForm.bookingDetails
          );

          // Update paid/pending amounts based on new total
          const accounting = calculateHallAccountingValues(
            newForm.paymentStatus as PaymentStatus,
            newForm.totalPrice,
            newForm.paidAmount
          );
          newForm.paidAmount = accounting.paid;
          newForm.pendingAmount = accounting.pendingAmount;

          // AUTO-ADJUST PAYMENT STATUS WHEN HALL/PRICING CHANGES IN EDIT MODE
          if (isEdit) {
            const oldPaid = prev.paidAmount || 0;
            const oldPaymentStatus = prev.paymentStatus;

            if (newForm.totalPrice < oldPaid) {
              newForm.paymentStatus = "PAID";
              newForm.paidAmount = newForm.totalPrice;
              newForm.pendingAmount = 0;
            } else if (newForm.totalPrice > oldPaid && oldPaymentStatus === "PAID") {
              newForm.paymentStatus = "HALF_PAID";
              newForm.pendingAmount = newForm.totalPrice - newForm.paidAmount;
            }
          }
        }

        // Handle duration change
        if (field === "numberOfDays") {
          if (newForm.bookingDate) {
            const startDate = parseLocalDate(newForm.bookingDate);
            const newEndDate = addDays(startDate, Math.max(1, value) - 1);
            newForm.endDate = format(newEndDate, "yyyy-MM-dd");
            // Set field to "endDate" to trigger the date sync logic below
            field = "endDate" as any;
          }
        }

        // Handle payment status changes
        if (field === "paymentStatus") {
          const accounting = calculateHallAccountingValues(
            value as PaymentStatus,
            newForm.totalPrice,
            newForm.paidAmount
          );
          newForm.paidAmount = accounting.paid;
          newForm.pendingAmount = accounting.pendingAmount;
        }

        // Handle paid amount changes
        if (field === "paidAmount") {
          if (value > newForm.totalPrice) {
            value = newForm.totalPrice;
            newForm.paidAmount = value;
          }
          newForm.pendingAmount = newForm.totalPrice - value;
        }

        // Update bookingDetails when dates or primary event type change
        if (["bookingDate", "endDate", "eventType", "numberOfDays"].includes(field as string)) {
          const start = field === "bookingDate" ? value : newForm.bookingDate;
          const end = field === "endDate" ? value : newForm.endDate;
          const currentPrimaryEventType = field === "eventType" ? value : newForm.eventType;
          const defaultSlot = "EVENING";

          if (start) {
            const startDate = parseLocalDate(start);
            const endDate = end ? parseLocalDate(end) : startDate;
            const days = Math.abs(differenceInCalendarDays(endDate, startDate)) + 1;
            newForm.numberOfDays = days;

            const newDetails: { date: string; timeSlot: string; eventType?: string }[] = [];
            for (let i = 0; i < days; i++) {
              const currentCheckDate = addDays(startDate, i);
              const dateStr = format(currentCheckDate, "yyyy-MM-dd");

              const existingDetails = prev.bookingDetails?.filter(d => d.date === dateStr);

              if (existingDetails && existingDetails.length > 0) {
                existingDetails.forEach(d => {
                  newDetails.push({
                    ...d,
                    date: dateStr, // Ensure standard format
                    eventType: field === "eventType" ? value : (d.eventType || currentPrimaryEventType)
                  });
                });
              } else {
                newDetails.push({
                  date: dateStr,
                  timeSlot: defaultSlot,
                  eventType: currentPrimaryEventType
                });
              }
            }
            newForm.bookingDetails = newDetails;

            // Recalculate price as slot count might have changed
            newForm.totalPrice = calculateHallPrice(halls, newForm.hallId, newForm.pricingType as PricingType, newForm.bookingDetails);
            newForm.pendingAmount = newForm.totalPrice - newForm.paidAmount;
          }
        }

        return newForm;
      });
    };
  };

  const handleFormChange = createFormChangeHandler(false);
  const handleEditFormChange = createFormChangeHandler(true);

  const handleCreate = () => {
    // Check if required fields are filled
    if (
      !form.membershipNo ||
      !form.hallId ||
      !form.bookingDate ||
      !form.eventType ||
      !form.eventTime ||
      form.numberOfGuests < 1
    ) {
      toast({
        title: "Please fill all required fields",
        description:
          "Membership, Hall, Booking Date, and Event Type are required",
        variant: "destructive",
      });
      return;
    }

    // Validate booking date
    const bookingDate = parseLocalDate(form.bookingDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (bookingDate < today && editForm.bookingDate === "") {
      // console.log(editForm)
      toast({
        title: "Invalid booking date",
        description: "Booking date cannot be in the past",
        variant: "destructive",
      });
      return;
    }

    // Validate paid amount for half-paid status
    if (form.paymentStatus === "HALF_PAID" && form.paidAmount <= 0) {
      toast({
        title: "Invalid paid amount",
        description: "Please enter a valid paid amount for half-paid status",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      category: "Hall",
      membershipNo: form.membershipNo,
      entityId: form.hallId,
      bookingDate: form.bookingDate,
      eventType: form.eventType,
      eventTime: form.bookingDetails[0]?.timeSlot || "EVENING",
      endDate: form.endDate,
      totalPrice: form.totalPrice.toString(),
      paymentStatus: form.paymentStatus,
      numberOfGuests: form.numberOfGuests || 0,
      paidAmount: form.paidAmount,
      pendingAmount: form.pendingAmount,
      pricingType: form.pricingType,
      paymentMode: "CASH",
      paidBy: form.paidBy,
      guestName: form.guestName,
      guestContact: form.guestContact,
      remarks: form.remarks,
      bookingDetails: form.bookingDetails,
    };

    createMutation.mutate(payload);
  };

  const handleUpdate = () => {

    // console.log(editForm)
    // Enhanced validation that handles null/undefined values
    const requiredFields = [
      { field: editForm.membershipNo, name: "Membership" },
      { field: editForm.hallId, name: "Hall" },
      { field: editForm.bookingDate, name: "Booking Date" },
      { field: editForm.eventType, name: "Event Type" },
      { field: editForm.numberOfGuests, name: "Number of Guests" }
    ];

    const missingFields = requiredFields.filter(
      ({ field }) => !field || field.toString().trim() === ""
    );

    if (editForm.numberOfGuests < 1) {
      toast({
        title: "Invalid number of guests",
        description: "Number of guests must be at least 1",
        variant: "destructive",
      });
      return;
    }

    if (missingFields.length > 0) {
      toast({
        title: "Please fill all required fields",
        description: `Missing: ${missingFields.map((f) => f.name).join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    // Validate booking date
    const bookingDate = parseLocalDate(editForm.bookingDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0)

    // Validate paid amount for half-paid status
    if (editForm.paymentStatus === "HALF_PAID" && editForm.paidAmount <= 0) {
      toast({
        title: "Invalid paid amount",
        description: "Please enter a valid paid amount for half-paid status",
        variant: "destructive",
      });
      return;
    }
    const payload = {
      id: editBooking?.id?.toString(),
      category: "Hall",
      membershipNo: editForm.membershipNo,
      entityId: editForm.hallId,
      bookingDate: editForm.bookingDate,
      eventType: editForm.eventType,
      eventTime: editForm.bookingDetails[0]?.timeSlot || "EVENING",
      endDate: editForm.endDate,
      numberOfGuests: editForm.numberOfGuests || 0,
      totalPrice: editForm.totalPrice.toString(),
      paymentStatus: editForm.paymentStatus,
      paidAmount: editForm.paidAmount,
      pendingAmount: editForm.pendingAmount,
      pricingType: editForm.pricingType,
      paymentMode: "CASH",
      paidBy: editForm.paidBy,
      guestName: editForm.guestName,
      guestContact: editForm.guestContact,
      remarks: editForm.remarks,
      bookingDetails: editForm.bookingDetails,
    };

    updateMutation.mutate(payload);
  };

  const handleDelete = () => {
    if (cancelBooking) {
      deleteMutation.mutate({
        bookingFor: "halls",
        bookID: cancelBooking.id.toString(),
      });
    }
  };

  const handleViewVouchers = (booking: HallBooking) => {
    setViewVouchers(booking);
  };

  const filteredBookings =
    paymentFilter === "ALL"
      ? bookings
      : bookings?.filter(
        (booking: HallBooking) => booking.paymentStatus === paymentFilter
      );

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case "PAID":
        return <Badge className="bg-green-600 text-white">Paid</Badge>;
      case "HALF_PAID":
        return <Badge className="bg-yellow-600 text-white">Half Paid</Badge>;
      case "UNPAID":
        return <Badge variant="destructive">Unpaid</Badge>;
      case "TO_BILL":
        return <Badge className="bg-blue-600 text-white">To Bill</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getVoucherBadge = (type: string) => {
    switch (type) {
      case "FULL_PAYMENT":
        return (
          <Badge className="bg-green-100 text-green-800">Full Payment</Badge>
        );
      case "HALF_PAYMENT":
        return (
          <Badge className="bg-blue-100 text-blue-800">Half Payment</Badge>
        );
      default:
        return <Badge>{type}</Badge>;
    }
  };

  const getVoucherStatusBadge = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return <Badge className="bg-green-100 text-green-800">Confirmed</Badge>;
      case "PENDING":
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "CANCELLED":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const resetForm = () => {
    setForm(hallInitialFormState);
    setMemberSearch("");
    setSelectedMember(null);
    setShowMemberResults(false);
  };

  const resetEditForm = () => {
    setEditForm(hallInitialFormState);
    setEditBooking(null);
  };

  // Update edit form when editBooking changes
  useEffect(() => {
    if (editBooking) {
      // console.log(editBooking)
      const newEditForm: HallBookingForm = {
        membershipNo: editBooking.member?.Membership_No || "",
        memberName: editBooking.memberName || editBooking.member?.Name || "",
        memberId: editBooking.memberId
          ? editBooking.memberId.toString()
          : "",
        category: "Hall",
        hallId: editBooking.hallId?.toString() || "",
        bookingDate: editBooking.bookingDate
          ? format(parseLocalDate(editBooking.bookingDate), "yyyy-MM-dd")
          : "",
        eventType: editBooking.eventType || "",
        eventTime: editBooking.bookingTime || "EVENING" as any as HallBookingTime,
        pricingType: editBooking.pricingType || "member" as any as PricingType,
        totalPrice: Number(editBooking.totalPrice) || 0,
        numberOfGuests: Number(editBooking.numberOfGuests),
        paymentStatus: editBooking.paymentStatus || "UNPAID" as any as PaymentStatus,
        paidAmount: Number(editBooking.paidAmount) || 0,
        pendingAmount: Number(editBooking.pendingAmount) || 0,
        numberOfDays: editBooking.numberOfDays || (editBooking.endDate && editBooking.bookingDate ? Math.abs(differenceInCalendarDays(parseLocalDate(editBooking.endDate), parseLocalDate(editBooking.bookingDate))) + 1 : 1),
        paymentMode: "CASH",

        paidBy: editBooking.paidBy,
        guestName: editBooking.guestName,
        guestContact: editBooking.guestContact,
        remarks: editBooking.remarks || "",
        endDate: editBooking.endDate ? format(parseLocalDate(editBooking.endDate), "yyyy-MM-dd") : "",
        bookingDetails: (() => {
          const details = (editBooking.bookingDetails as any[]) || [];
          if (details.length > 0) {
            // Ensure dates are yyyy-MM-dd strings in LOCAL time for consistency
            return details.map(d => {
              let dateStr = d.date;
              // If date comes as ISO string from backend (e.g., 2025-12-27T19:00:00.000Z),
              // we need to parse it as a Date and format it in local time
              // because 7PM UTC = midnight next day in Pakistan (UTC+5)
              if (typeof dateStr === 'string' && dateStr.includes('T')) {
                const dateObj = new Date(dateStr);
                // Format in local time (yyyy-MM-dd)
                dateStr = format(dateObj, "yyyy-MM-dd");
              }
              return {
                date: dateStr,
                timeSlot: d.timeSlot,
                eventType: d.eventType || editBooking.eventType
              };
            });
          }
          // Legacy support: generate based on range
          const start = parseLocalDate(editBooking.bookingDate);
          const end = editBooking.endDate ? parseLocalDate(editBooking.endDate) : start;
          const days = Math.abs(differenceInCalendarDays(end, start)) + 1;
          const generated = [];
          for (let i = 0; i < days; i++) {
            generated.push({
              date: format(addDays(start, i), "yyyy-MM-dd"),
              timeSlot: editBooking.bookingTime || "EVENING",
              eventType: editBooking.eventType
            });
          }
          return generated;
        })(),
      };
      setEditForm(newEditForm);
    }
  }, [editBooking]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Hall Bookings
          </h2>
          <p className="text-muted-foreground">
            Manage event hall reservations
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="HALF_PAID">Half Paid</SelectItem>
              <SelectItem value="UNPAID">Unpaid</SelectItem>
              <SelectItem value="TO_BILL">To Bill</SelectItem>
            </SelectContent>
          </Select>
          <Dialog
            open={isAddOpen}
            onOpenChange={(open) => {
              setIsAddOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Booking
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Hall Booking</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                {/* Member Search for Create */}
                <MemberSearchComponent
                  searchTerm={memberSearch}
                  onSearchChange={handleMemberSearch}
                  showResults={showMemberResults}
                  searchResults={searchResults}
                  isSearching={isSearching}
                  selectedMember={selectedMember}
                  onSelectMember={handleSelectMember}
                  onClearMember={handleClearMember}
                  onFocus={handleSearchFocus}
                />

                {/* Hall Selection */}
                <div>
                  <Label>Hall *</Label>
                  {isLoadingHalls ? (
                    <div className="h-10 bg-muted animate-pulse rounded-md mt-2" />
                  ) : (
                    <Select
                      value={form.hallId}
                      onValueChange={(val) => {
                        handleFormChange("hallId", val);
                      }}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select hall" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableHalls.map((hall: Hall) => (
                          <SelectItem key={hall.id} value={hall.id.toString()}>
                            {hall.name} - Capacity: {hall.capacity} | PKR{" "}
                            {hall.chargesMembers.toLocaleString()} (Member) /
                            PKR {hall.chargesGuests.toLocaleString()} (Guest)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="md:col-span-2">
                  <Label>Booking Dates *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal h-12 bg-muted/30 border-none shadow-none mt-2",
                          !form.bookingDate && "text-muted-foreground"
                        )}
                      >
                        <NotepadText className="mr-2 h-4 w-4" />
                        {form.bookingDate ? (
                          form.endDate && form.endDate !== form.bookingDate ? (
                            <>
                              {format(parseLocalDate(form.bookingDate), "LLL dd, y")} -{" "}
                              {format(parseLocalDate(form.endDate), "LLL dd, y")}
                            </>
                          ) : (
                            format(parseLocalDate(form.bookingDate), "LLL dd, y")
                          )
                        ) : (
                          <span>Select dates</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={form.bookingDate ? parseLocalDate(form.bookingDate) : new Date()}
                        selected={{
                          from: form.bookingDate ? parseLocalDate(form.bookingDate) : undefined,
                          to: form.endDate ? parseLocalDate(form.endDate) : undefined,
                        }}
                        onSelect={(range) => {
                          if (range?.from) {
                            const fromStr = format(range.from, "yyyy-MM-dd");
                            const toStr = range.to ? format(range.to, "yyyy-MM-dd") : fromStr;

                            // Trigger separate updates to ensure handlers run
                            handleFormChange("bookingDate", fromStr);
                            handleFormChange("endDate", toStr);
                          } else {
                            handleFormChange("bookingDate", "");
                            handleFormChange("endDate", "");
                          }
                        }}
                        numberOfMonths={2}
                        disabled={(date) => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          return date < today;
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                  {form.bookingDate && form.endDate && (
                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                      <NotepadText className="h-3 w-3" />
                      Total duration: {Math.abs(differenceInCalendarDays(parseLocalDate(form.endDate), parseLocalDate(form.bookingDate))) + 1} days
                    </p>
                  )}
                </div>


                <div>
                  <Label>Event Type *</Label>
                  <Select
                    value={form.eventType}
                    onValueChange={(val) => handleFormChange("eventType", val)}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select event type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mehandi">Mehandi</SelectItem>
                      <SelectItem value="barat">Barat</SelectItem>
                      <SelectItem value="walima">Walima</SelectItem>
                      <SelectItem value="birthday">Birthday</SelectItem>
                      <SelectItem value="corporate">Corporate Event</SelectItem>
                      <SelectItem value="wedding">Wedding</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {form.bookingDate && form.endDate && (
                  <IndividualTimeSlotSelector
                    bookingDetails={form.bookingDetails}
                    hallId={form.hallId}
                    bookings={bookings}
                    halls={halls}
                    reservations={reservations}
                    onChange={(newDetails) => {
                      setForm(prev => {
                        const newPrice = calculateHallPrice(halls, prev.hallId, prev.pricingType as PricingType, newDetails);
                        return {
                          ...prev,
                          bookingDetails: newDetails,
                          totalPrice: newPrice,
                          pendingAmount: newPrice - prev.paidAmount
                        };
                      });
                    }}
                    defaultEventType={form.eventType}
                  />
                )}

                <div>
                  <Label>Pricing Type</Label>
                  <Select
                    value={form.pricingType}
                    onValueChange={(val) =>
                      handleFormChange("pricingType", val)
                    }
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="guest">Guest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Number of Guests *</Label>
                  <Input
                    type="number"
                    value={form.numberOfGuests || ""}
                    onChange={(e) => handleFormChange("numberOfGuests", parseInt(e.target.value) || 0)}
                    className="mt-2"
                    placeholder="Enter number of guests"
                    min="1"
                  />
                </div>

                {/* Remarks (Optional) */}
                <div className="md:col-span-2">
                  <Label>Remarks (Optional)</Label>
                  <textarea
                    className="w-full p-2 mt-2 border rounded-md resize-none min-h-[60px] text-sm"
                    placeholder="Add notes about this booking (e.g., special arrangements, event details, etc.)"
                    value={form.remarks || ""}
                    onChange={(e) => handleFormChange("remarks", e.target.value)}
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    These remarks will be stored with the booking record
                  </div>
                </div>

                <HallPaymentSection form={form} onChange={handleFormChange} />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={createMutation.isPending || !selectedMember}
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    "Create Booking"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoadingBookings ? (
            <div className="flex justify-center items-center py-32">
              <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="text-center py-32 text-muted-foreground text-lg">
              No hall bookings found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Hall</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Total Price</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBookings.map((booking: HallBooking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-medium">
                      {booking.member?.Name || booking.member?.Membership_No}
                    </TableCell>
                    <TableCell>
                      {booking.hall?.name || booking.hallName}
                    </TableCell>
                    <TableCell>
                      {format(parseLocalDate(booking.bookingDate), "PP")}
                      {booking.endDate && booking.endDate !== booking.bookingDate && (
                        <> - {format(parseLocalDate(booking.endDate), "PP")}</>
                      )}
                    </TableCell>
                    <TableCell>{booking.eventType}</TableCell>
                    <TableCell>
                      {(() => {
                        if (booking.bookingDetails && booking.bookingDetails.length > 0) {
                          if (booking.bookingDetails.length === 1) return booking.bookingDetails[0].timeSlot;
                          return `${booking.bookingDetails.length} Slots`;
                        }
                        return booking.bookingTime;
                      })()}
                    </TableCell>
                    <TableCell>
                      PKR {booking.totalPrice?.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {getPaymentBadge(booking.paymentStatus)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDetailBooking(booking)
                            setOpenDetails(true)
                          }}
                          title="Booking Details">
                          <NotepadText />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditBooking(booking)}
                          title="Edit Booking"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {(booking.paymentStatus === "PAID" ||
                          booking.paymentStatus === "HALF_PAID") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewVouchers(booking)}
                              title="View Vouchers"
                            >
                              <Receipt className="h-4 w-4" />
                            </Button>
                          )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => setCancelBooking(booking)}
                          title="Cancel Booking"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog
        open={!!editBooking}
        onOpenChange={(open) => {
          if (!open) resetEditForm();
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Hall Booking</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            {/* Member Information Display (Read-only) */}
            <div className="md:col-span-2">
              <Label>Member Information</Label>
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-sm flex items-center">
                      <User className="h-4 w-4 mr-2 text-blue-600" />
                      {editBooking?.member?.Name || editBooking?.memberName}
                    </div>
                    <div className="text-xs text-blue-600 mt-1">
                      {editBooking?.Membership_No &&
                        `Membership: #${editBooking.Membership_No}`}
                      {editBooking?.member?.Balance !== undefined && (
                        <div className="mt-1 space-y-1">
                          <Badge
                            variant={
                              editBooking.member.Balance >= 0
                                ? "outline"
                                : "destructive"
                            }
                            className="bg-blue-100 text-blue-800"
                          >
                            Account Balance: PKR{" "}
                            {editBooking.member.Balance.toLocaleString()}
                          </Badge>
                          <div className="text-xs">
                            <span className="text-green-700">
                              DR: PKR{" "}
                              {editBooking.member.drAmount?.toLocaleString() ||
                                "0"}
                            </span>
                            {" • "}
                            <span className="text-red-700">
                              CR: PKR{" "}
                              {editBooking.member.crAmount?.toLocaleString() ||
                                "0"}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-blue-100 text-blue-800"
                  >
                    Current Booking
                  </Badge>
                </div>
              </div>
            </div>


            {/* Conflict Warning */}
            {editForm.hallId && editForm.bookingDate && editForm.eventTime && (
              <div className="md:col-span-2">
                {(() => {
                  const conflict = checkHallConflicts(
                    editForm.hallId,
                    editForm.bookingDate,
                    editForm.endDate,
                    editForm.eventTime,
                    bookings,
                    halls,
                    reservations,
                    editBooking?.id?.toString(),
                    editForm.bookingDetails
                  );
                  if (conflict.hasConflict) {
                    return (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-red-700 text-sm">
                        <XCircle className="h-4 w-4" />
                        <span>{conflict.message}</span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}
            {/* Conflict Warning Ends */}
            {form.hallId && form.bookingDate && form.eventTime && (
              <div className="md:col-span-2">
                {(() => {
                  const conflict = checkHallConflicts(
                    form.hallId,
                    form.bookingDate,
                    form.endDate,
                    form.eventTime,
                    bookings,
                    halls,
                    reservations,
                    undefined,
                    form.bookingDetails
                  );
                  if (conflict.hasConflict) {
                    return (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-red-700 text-sm">
                        <XCircle className="h-4 w-4" />
                        <span>{conflict.message}</span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}

            <div>
              <Label>Hall *</Label>
              {isLoadingHalls ? (
                <div className="h-10 bg-muted animate-pulse rounded-md mt-2" />
              ) : (
                <Select
                  value={editForm.hallId}
                  onValueChange={(val) => {
                    handleEditFormChange("hallId", val);
                  }}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select hall" />
                  </SelectTrigger>
                  <SelectContent>
                    {halls.map((hall: Hall) => (
                      <SelectItem key={hall.id} value={hall.id.toString()}>
                        {hall.name} - Capacity: {hall.capacity} | PKR{" "}
                        {hall.chargesMembers.toLocaleString()} (Member) / PKR{" "}
                        {hall.chargesGuests.toLocaleString()} (Guest)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="md:col-span-2">
              <Label>Booking Dates *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal h-12 bg-muted/30 border-none shadow-none mt-2",
                      !editForm.bookingDate && "text-muted-foreground"
                    )}
                  >
                    <NotepadText className="mr-2 h-4 w-4" />
                    {editForm.bookingDate ? (
                      editForm.endDate && editForm.endDate !== editForm.bookingDate ? (
                        <>
                          {format(parseLocalDate(editForm.bookingDate), "LLL dd, y")} -{" "}
                          {format(parseLocalDate(editForm.endDate), "LLL dd, y")}
                        </>
                      ) : (
                        format(parseLocalDate(editForm.bookingDate), "LLL dd, y")
                      )
                    ) : (
                      <span>Select dates</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={editForm.bookingDate ? parseLocalDate(editForm.bookingDate) : new Date()}
                    selected={{
                      from: editForm.bookingDate ? parseLocalDate(editForm.bookingDate) : undefined,
                      to: editForm.endDate ? parseLocalDate(editForm.endDate) : undefined,
                    }}
                    onSelect={(range) => {
                      if (range?.from) {
                        const fromStr = format(range.from, "yyyy-MM-dd");
                        const toStr = range.to ? format(range.to, "yyyy-MM-dd") : fromStr;

                        // Trigger separate updates to ensure handlers run
                        handleEditFormChange("bookingDate", fromStr);
                        handleEditFormChange("endDate", toStr);
                      } else {
                        handleEditFormChange("bookingDate", "");
                        handleEditFormChange("endDate", "");
                      }
                    }}
                    numberOfMonths={2}
                    disabled={(date) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      return date < today;
                    }}
                  />
                </PopoverContent>
              </Popover>
              {editForm.bookingDate && editForm.endDate && (
                <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                  <NotepadText className="h-3 w-3" />
                  Total duration: {Math.abs(differenceInCalendarDays(parseLocalDate(editForm.endDate), parseLocalDate(editForm.bookingDate))) + 1} days
                </p>
              )}
            </div>


            <div>
              <Label>Event Type *</Label>
              <Select
                value={editForm.eventType}
                onValueChange={(val) => handleEditFormChange("eventType", val)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mehandi">Mehandi</SelectItem>
                  <SelectItem value="barat">Barat</SelectItem>
                  <SelectItem value="walima">Walima</SelectItem>
                  <SelectItem value="birthday">Birthday</SelectItem>
                  <SelectItem value="corporate">Corporate Event</SelectItem>
                  <SelectItem value="wedding">Wedding</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editForm.bookingDate && editForm.endDate && (
              <IndividualTimeSlotSelector
                bookingDetails={editForm.bookingDetails}
                hallId={editForm.hallId}
                bookings={bookings}
                halls={halls}
                reservations={reservations}
                editBookingId={editBooking?.id?.toString()}
                onChange={(newDetails) => {
                  setEditForm(prev => {
                    const newPrice = calculateHallPrice(halls, prev.hallId, prev.pricingType as PricingType, newDetails);
                    return {
                      ...prev,
                      bookingDetails: newDetails,
                      totalPrice: newPrice,
                      pendingAmount: newPrice - prev.paidAmount
                    };
                  });
                }}
                defaultEventType={editForm.eventType}
              />
            )}

            <div>
              <Label>Pricing Type</Label>
              <Select
                value={editForm.pricingType}
                onValueChange={(val) =>
                  handleEditFormChange("pricingType", val)
                }
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="guest">Guest</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Number of Guests *</Label>
              <Input
                type="number"
                value={editForm.numberOfGuests || ""}
                onChange={(e) => handleEditFormChange("numberOfGuests", parseInt(e.target.value) || 0)}
                className="mt-2"
                placeholder="Enter number of guests"
                min="1"
              />
            </div>

            {/* guest information */}
            {editForm.pricingType == "guest" && <div className="p-4 rounded-xl border bg-white shadow-sm w-full col-span-full">

              <h3 className="text-lg font-semibold mb-4">Guest Information</h3>

              <div className="flex  flex-col">

                <div className="flex items-center justify-center gap-x-5">

                  <div className="w-1/2">
                    <Label className="text-sm font-medium mb-1 block whitespace-nowrap">
                      Guest Name *
                    </Label>
                    {/* {console.log(form)} */}

                    <FormInput
                      label=""
                      type="text"
                      value={editForm.guestName}
                      onChange={(val) => handleEditFormChange("guestName", val)}
                    />
                  </div>

                  <div className="w-1/2">
                    <Label className="text-sm font-medium mb-1 block whitespace-nowrap">
                      Contact
                    </Label>

                    <FormInput
                      label=""
                      type="number"
                      value={editForm.guestContact}
                      onChange={(val) => handleEditFormChange("guestContact", val)}
                      min="0"
                    />
                  </div>

                </div>

                <div className="sm:col-span-2 lg:col-span-1">
                  <Label className="text-sm font-medium my-2 block whitespace-nowrap">
                    Who will Pay?
                  </Label>
                  <Select
                    value={editForm.paidBy}
                    onValueChange={(val) => handleEditFormChange("paidBy", val)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Who will pay?" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="MEMBER">Member</SelectItem>
                      <SelectItem value="GUEST">Guest</SelectItem>
                    </SelectContent>
                  </Select>


                </div>

              </div>
            </div>}

            {/* Remarks (Optional) */}
            <div className="md:col-span-2">
              <Label>Remarks (Optional)</Label>
              <textarea
                className="w-full p-2 mt-2 border rounded-md resize-none min-h-[60px] text-sm"
                placeholder="Add notes about this booking update (e.g., reason for changes, refund details, etc.)"
                value={editForm.remarks || ""}
                onChange={(e) => handleEditFormChange("remarks", e.target.value)}
              />
              <div className="text-xs text-muted-foreground mt-1">
                These remarks will be stored with the booking record
              </div>
            </div>

            <HallPaymentSection
              form={editForm}
              onChange={handleEditFormChange}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => resetEditForm()}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Updating...
                </>
              ) : (
                "Update Booking"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* booking details */}
      <Dialog open={openDetails} onOpenChange={setOpenDetails}>
        <DialogContent className="p-0 max-w-5xl min-w-4xl max-h-[90vh] overflow-y-auto">
          {detailBooking && (
            <HallBookingDetailsCard
              booking={detailBooking}
              className="rounded-none border-0 shadow-none"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Vouchers Dialog */}
      <Dialog
        open={!!viewVouchers}
        onOpenChange={(open) => {
          if (!open) setViewVouchers(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payment Vouchers</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {/* <div className="mb-6 p-4 bg-muted/50 rounded-lg">
              <h3 className="font-semibold mb-2">Booking Information</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Booking ID:</div>
                <div className="font-medium">#{viewVouchers?.id}</div>

                <div>Member:</div>
                <div className="font-medium">{viewVouchers?.memberName}</div>

                <div>Hall:</div>
                <div className="font-medium">
                  {viewVouchers?.hall?.name || viewVouchers?.hallName}
                </div>

                <div>Total Amount:</div>
                <div className="font-medium text-green-600">
                  PKR {viewVouchers?.totalPrice?.toLocaleString()}
                </div>

                <div>Payment Status:</div>
                <div>
                  {getPaymentBadge(viewVouchers?.paymentStatus || "UNPAID")}
                </div>
              </div>
            </div>

            <h3 className="font-semibold mb-4">Generated Vouchers</h3> */}

            {isLoadingVouchers ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : vouchers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No vouchers generated yet.</p>
                <p className="text-sm">
                  Vouchers will be created when payments are made.
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {/* {console.log(vouchers)} */}
                {vouchers.map((voucher) => (
                  <div
                    key={voucher.id}
                    className="p-4 border rounded-lg bg-muted/50"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {getVoucherBadge(voucher.voucher_type)}
                          {getVoucherStatusBadge(voucher.status)}
                        </div>
                        <div className="text-sm font-mono text-muted-foreground">
                          Voucher #: {voucher.voucher_no}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">
                          PKR {parseFloat(voucher.amount).toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {voucher.payment_mode?.toLowerCase() || "cash"}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <div>
                        <div className="font-medium">Booking Type</div>
                        <div>{voucher.booking_type}</div>
                      </div>
                      <div>
                        <div className="font-medium">Membership No</div>
                        <div>{voucher.membership_no}</div>
                      </div>
                      <div>
                        <div className="font-medium">Issued By</div>
                        <div>{voucher.issued_by || "—"}</div>
                      </div>
                      <div>
                        <div className="font-medium">Issued At</div>
                        <div>
                          {voucher.issued_at
                            ? new Date(voucher.issued_at).toLocaleDateString()
                            : "—"}
                        </div>
                      </div>
                    </div>

                    {voucher.transaction_id && (
                      <div className="mt-2 text-sm">
                        <div className="font-medium">Transaction ID</div>
                        <div className="font-mono text-muted-foreground">
                          {voucher.transaction_id}
                        </div>
                      </div>
                    )}

                    {voucher.remarks && (
                      <div className="mt-3 p-2 bg-white border rounded text-sm">
                        <div className="font-medium">Remarks</div>
                        <div className="text-muted-foreground">
                          {voucher.remarks}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setViewVouchers(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={!!cancelBooking}
        onOpenChange={() => setCancelBooking(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
          </DialogHeader>
          <p className="py-4">
            Are you sure you want to cancel this booking for{" "}
            <strong>{cancelBooking?.memberName}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelBooking(null)}>
              No
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Cancelling...
                </>
              ) : (
                "Cancel Booking"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
