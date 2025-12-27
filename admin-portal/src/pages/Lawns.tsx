import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Edit,
  Trash2,
  FileDown,
  Loader2,
  Calendar as CalendarIcon,
  AlertCircle,
  Sun,
  Moon,
  Sunset,
  Clock,
  NotepadText,
  Eye,
  Info,
  Users,
  DollarSign,
  Settings,
  DoorOpen,
} from "lucide-react";
import { DateRange } from "react-day-picker";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { exportLawnsReport } from "@/lib/pdfExport";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createLawn,
  getLawns,
  updateLawn,
  deleteLawn,
  getLawnCategories,
  reserveLawn,
  getLawnLogs,
} from "../../config/apis";

interface LawnOutOfOrder {
  id?: number;
  reason: string;
  startDate: string;
  endDate: string;
}

interface LawnCategory {
  id: number;
  category: string;
}

interface LawnReservation {
  id: number;
  lawnId: number;
  reservedFrom: string;
  reservedTo: string;
  timeSlot: string;
  remarks?: string;
  admin: {
    id: number;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface LawnBooking {
  id: number;
  lawnId: number;
  bookingDate: string;
  endDate: string;
  bookingTime: string;
  member: {
    Name: string;
    Membership_No: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface Lawn {
  id: number;
  lawnCategoryId: number;
  description: string;
  minGuests: number;
  maxGuests: number;
  memberCharges: string | number;
  guestCharges: string | number;
  isActive: boolean;
  isOutOfService: boolean;
  outOfOrders: LawnOutOfOrder[];
  lawnCategory: LawnCategory;
  holdings?: any[];
  reservations: LawnReservation[];
  bookings: LawnBooking[];
}

interface LawnForm {
  lawnCategoryId: string;
  description: string;
  minGuests: string;
  maxGuests: string;
  memberCharges: string;
  guestCharges: string;
  isOutOfService: boolean;
  isActive: boolean;
  outOfOrders: LawnOutOfOrder[];
}

const initialFormState: LawnForm = {
  lawnCategoryId: "",
  description: "",
  minGuests: "",
  maxGuests: "",
  memberCharges: "0",
  guestCharges: "0",
  isOutOfService: false,
  isActive: true,
  outOfOrders: [],
};

const initialOutOfOrderState: LawnOutOfOrder = {
  reason: "",
  startDate: "",
  endDate: "",
};

const getDaySortKey = (dateString: any) => {
  if (!dateString) return "1970-01-01";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "1970-01-01";
    return format(d, "yyyy-MM-dd");
  } catch (e) {
    return "1970-01-01";
  }
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString();
};

const StatusIndicator = ({ isActive }: { isActive: boolean }) => {
  return isActive ? (
    <Badge className="bg-emerald-600">Active</Badge>
  ) : (
    <Badge variant="outline">Inactive</Badge>
  );
};

const isCurrentlyHeld = (lawn: Lawn) => {
  if (!lawn.holdings || lawn.holdings.length === 0) return false;
  const now = new Date();
  return lawn.holdings.some(h => {
    if (!h.onHold) return false;
    const expiry = new Date(h.holdExpiry);
    if (expiry < now) return false;

    // Granular hold check
    if (h.fromDate && h.toDate) {
      const start = new Date(h.fromDate);
      const end = new Date(h.toDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      if (now >= start && now <= end) return true;
    } else {
      // Legacy hold (only expiry matters)
      return true;
    }
    return false;
  });
};

const getLawnStatus = (lawn: Lawn) => {
  const now = new Date();
  const today = new Date().setHours(0, 0, 0, 0);

  const currentOut = lawn.outOfOrders?.find(p => {
    const s = new Date(p.startDate).setHours(0, 0, 0, 0);
    const e = new Date(p.endDate).setHours(0, 0, 0, 0);
    return today >= s && today <= e;
  });
  if (currentOut) return "Maintenance";

  const currentBooking = lawn.bookings?.find(b => {
    const s = new Date(b.bookingDate).setHours(0, 0, 0, 0);
    const e = new Date(b.endDate).setHours(0, 0, 0, 0);
    return today >= s && today <= e;
  });
  if (currentBooking) return "Booked";

  if (isCurrentlyHeld(lawn)) return "On Hold";
  if (!lawn.isActive) return "Inactive";
  return "Available";
};

const getLawnStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" => {
  switch (status) {
    case "Available": return "success" as any;
    case "Booked": return "default";
    case "Maintenance": return "destructive";
    case "On Hold": return "warning" as any;
    case "Inactive": return "outline";
    default: return "outline";
  }
};

const MaintenanceIndicator = ({
  outOfOrders,
  isOutOfService,
}: {
  outOfOrders: LawnOutOfOrder[];
  isOutOfService: boolean;
}) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const today = now.getTime();

  // All current or future periods
  const activeAndFuture = outOfOrders
    ?.filter((p) => new Date(p.endDate).getTime() >= today)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()) || [];

  const displayCount = 2;
  const sliced = activeAndFuture.slice(0, displayCount);
  const remaining = activeAndFuture.length - displayCount;

  if (activeAndFuture.length === 0 && !isOutOfService) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1 mt-2">
      {isOutOfService && !activeAndFuture.some(p => new Date(p.startDate).getTime() <= today && new Date(p.endDate).getTime() >= today) && (
        <Badge variant="destructive" className="w-fit text-[10px] py-0 px-1.5 h-4">Manual Out of Service</Badge>
      )}
      {sliced.map((p, idx) => {
        const isCurrent = new Date(p.startDate).getTime() <= today && new Date(p.endDate).getTime() >= today;
        return (
          <div key={idx} className="flex flex-col gap-0.5 bg-orange-50 p-1.5 rounded border border-orange-100">
            <div className="flex items-center gap-1">
              <Badge
                variant={isCurrent ? "destructive" : "secondary"}
                className={`text-[9px] py-0 px-1 h-3.5 ${!isCurrent ? "bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200" : ""}`}
              >
                {isCurrent ? "Maintenance" : "Scheduled"}
              </Badge>
            </div>
            <span className={`text-[10px] font-medium leading-tight ${isCurrent ? "text-red-700" : "text-orange-700"}`}>
              {p.reason}
            </span>
            <span className="text-[9px] text-muted-foreground italic">
              ({new Date(p.startDate).toLocaleDateString()} - {new Date(p.endDate).toLocaleDateString()})
            </span>
          </div>
        );
      })}
      {remaining > 0 && (
        <span className="text-[9px] text-muted-foreground font-medium pl-1">
          + {remaining} more periods
        </span>
      )}
    </div>
  );
};

const OutOfOrderPeriods = ({
  periods,
  onAddPeriod,
  onRemovePeriod,
  newPeriod,
  onNewPeriodChange,
}: {
  periods: LawnOutOfOrder[];
  onAddPeriod: () => void;
  onRemovePeriod: (index: number) => void;
  newPeriod: LawnOutOfOrder;
  onNewPeriodChange: (period: LawnOutOfOrder) => void;
}) => {
  return (
    <div className="space-y-4 p-4 rounded-lg border bg-slate-50/50">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          Maintenance Periods
        </Label>
        <Badge variant="outline">{periods.length} Saved</Badge>
      </div>

      {periods.length > 0 && (
        <div className="space-y-2">
          {periods.map((period, index) => (
            <div key={index} className="flex justify-between items-center bg-white p-2 border rounded text-xs">
              <div>
                <span className="font-bold text-orange-800">{formatDate(period.startDate)} - {formatDate(period.endDate)}</span>
                <p className="text-muted-foreground italic">{period.reason}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onRemovePeriod(index)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 p-3 border-2 border-dashed rounded-md bg-orange-50/30">
        <div className="col-span-2">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Reason</Label>
          <Input value={newPeriod.reason} onChange={(e) => onNewPeriodChange({ ...newPeriod, reason: e.target.value })} placeholder="Maintenance Reason" />
        </div>
        <div className="col-span-2">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Date Range</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal h-10 bg-white border-input shadow-sm mt-1",
                  !newPeriod.startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {newPeriod.startDate ? (
                  newPeriod.endDate && newPeriod.endDate !== newPeriod.startDate ? (
                    <>
                      {format(new Date(newPeriod.startDate), "LLL dd, y")} -{" "}
                      {format(new Date(newPeriod.endDate), "LLL dd, y")}
                    </>
                  ) : (
                    format(new Date(newPeriod.startDate), "LLL dd, y")
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
                defaultMonth={newPeriod.startDate ? new Date(newPeriod.startDate) : new Date()}
                selected={{
                  from: newPeriod.startDate ? new Date(newPeriod.startDate) : undefined,
                  to: newPeriod.endDate ? new Date(newPeriod.endDate) : undefined,
                }}
                onSelect={(range) => {
                  if (range?.from) {
                    const fromStr = format(range.from, "yyyy-MM-dd");
                    const toStr = range.to ? format(range.to, "yyyy-MM-dd") : fromStr;
                    onNewPeriodChange({ ...newPeriod, startDate: fromStr, endDate: toStr });
                  } else {
                    onNewPeriodChange({ ...newPeriod, startDate: "", endDate: "" });
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
        </div>
        <Button size="sm" className="col-span-2 h-8" variant="secondary" onClick={onAddPeriod} disabled={!newPeriod.reason || !newPeriod.startDate || !newPeriod.endDate}>
          <Plus className="h-3 w-3 mr-1" /> Add Period
        </Button>
      </div>
    </div>
  );
};

const LawnDetailDialog = ({
  lawn,
  onClose,
  logs,
  loading,
  dateRange,
  onDateRangeChange,
  activeTab,
  onTabChange,
}: {
  lawn: Lawn | null;
  onClose: () => void;
  logs: any;
  loading: boolean;
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}) => {
  if (!lawn) return null;

  return (
    <Dialog open={!!lawn} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <div>
              <DialogTitle className="text-2xl font-bold">
                {lawn.lawnCategory.category}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="font-normal border-primary/20 bg-primary/5 text-primary">
                  Lawn
                </Badge>
                <span className="text-sm text-muted-foreground">
                  ID: {lawn.id}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">{lawn.description}</span>
            </div>
            <Badge
              variant={lawn.isActive ? "default" : "secondary"}
              className={cn(
                "px-3 py-1",
                lawn.isActive
                  ? "bg-green-100 text-green-700 hover:bg-green-100"
                  : "bg-red-100 text-red-700 hover:bg-red-100"
              )}
            >
              {lawn.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 py-2">
          <Card className="p-3 bg-muted/20 border border-border/50 shadow-none transition-all hover:bg-muted/30 text-left">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-slate-100 rounded-md">
                <Users className="h-4 w-4 text-slate-600" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight">
                  Member Price
                </p>
                <p className="text-sm font-bold text-slate-700">
                  Rs. {Number(lawn.memberCharges || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-3 bg-muted/20 border border-border/50 shadow-none transition-all hover:bg-muted/30 text-left">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-slate-100 rounded-md">
                <Users className="h-4 w-4 text-slate-600" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight">
                  Guest Price
                </p>
                <p className="text-sm font-bold text-slate-700">
                  Rs. {Number(lawn.guestCharges || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-3 bg-muted/20 border border-border/50 shadow-none transition-all hover:bg-muted/30 text-left overflow-hidden">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-slate-100 rounded-md shrink-0">
                <Info className="h-4 w-4 text-slate-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight whitespace-nowrap">
                  Description
                </p>
                <p className="text-xs truncate text-slate-600">
                  {lawn.description || "No description provided."}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Small Overview Totals */}
        <div className="flex items-center gap-4 py-2 border-y border-border/40">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
            <span className="text-[11px] font-medium text-slate-500">
              Reservations: <span className="text-slate-900">{logs?.reservations?.length || 0}</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 border-l pl-4 border-border/40">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
            <span className="text-[11px] font-medium text-slate-500">
              Bookings: <span className="text-slate-900">{logs?.bookings?.length || 0}</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 border-l pl-4 border-border/40">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
            <span className="text-[11px] font-medium text-slate-500">
              Maintenance: <span className="text-slate-900">{logs?.outOfOrders?.length || 0}</span>
            </span>
          </div>
        </div>

        <div className="space-y-6 pt-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-slate-700">
              Activity Logs
              {loading && <div className="h-3 w-3 animate-spin rounded-full border border-slate-400 border-t-transparent" />}
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Filter Logs:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "justify-start text-left font-normal h-9",
                      !dateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "LLL dd, y")} -{" "}
                          {format(dateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(dateRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={onDateRangeChange}
                    numberOfMonths={2}
                    classNames={{
                      day_today: "border-2 border-primary text-primary bg-transparent font-bold",
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={onTabChange}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-3 h-9 p-1 bg-slate-100 rounded-md">
              <TabsTrigger value="reservations" className="text-[11px] rounded-sm data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border border-slate-200">
                Reservations ({logs?.reservations?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="bookings" className="text-[11px] rounded-sm data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border border-slate-200">
                Bookings ({logs?.bookings?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="maintenance" className="text-[11px] rounded-sm data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border border-slate-200">
                Maintenance ({logs?.outOfOrders?.length || 0})
              </TabsTrigger>
            </TabsList>

            <div className="mt-4 min-h-[300px]">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-[300px] gap-2 text-slate-400">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-300"></div>
                  <p className="text-[11px] font-medium">Loading history...</p>
                </div>
              ) : (
                <>
                  <TabsContent value="reservations" className="mt-0 outline-none">
                    <div className="border border-slate-100 rounded-lg overflow-hidden bg-white">
                      <Table>
                        <TableHeader className="bg-slate-50/50">
                          <TableRow className="hover:bg-transparent border-slate-100">
                            <TableHead className="text-[11px] h-9 text-slate-500">Reserved From</TableHead>
                            <TableHead className="text-[11px] h-9 text-slate-500">Reserved To</TableHead>
                            <TableHead className="text-[11px] h-9 text-slate-500">Time Slot</TableHead>
                            <TableHead className="text-[11px] h-9 text-slate-500">Reserved By</TableHead>
                            <TableHead className="text-[11px] h-9 text-slate-500 text-right">Remarks</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {logs?.reservations?.length ? (
                            logs.reservations.map((res: any) => (
                              <TableRow key={res.id} className="hover:bg-slate-50/50 transition-colors border-slate-50">
                                <TableCell className="text-xs py-2 text-slate-600">
                                  {format(new Date(res.reservedFrom), "LLL dd, y")}
                                </TableCell>
                                <TableCell className="text-xs py-2 text-slate-600">
                                  {format(new Date(res.reservedTo), "LLL dd, y")}
                                </TableCell>
                                <TableCell className="text-xs py-2 text-slate-600">
                                  {res.timeSlot}
                                </TableCell>
                                <TableCell className="text-xs py-2">
                                  <div className="flex items-center gap-2 text-slate-600">
                                    <div className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-500">
                                      {res.admin?.name?.substring(0, 1).toUpperCase()}
                                    </div>
                                    {res.admin?.name}
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs py-2 text-slate-500 text-right italic font-normal">
                                  {res.remarks || "—"}
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell
                                colSpan={5}
                                className="text-center py-10 text-slate-400"
                              >
                                <div className="flex flex-col items-center gap-1.5">
                                  <CalendarIcon className="h-6 w-6 opacity-10" />
                                  <p className="text-[11px]">No reservations found.</p>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  <TabsContent value="bookings" className="mt-0 outline-none">
                    <div className="border border-slate-100 rounded-lg overflow-hidden bg-white">
                      <Table>
                        <TableHeader className="bg-slate-50/50">
                          <TableRow className="hover:bg-transparent border-slate-100">
                            <TableHead className="text-[11px] h-9 text-slate-500">Member</TableHead>
                            <TableHead className="text-[11px] h-9 text-slate-500">Date</TableHead>
                            <TableHead className="text-[11px] h-9 text-slate-500">Slot</TableHead>
                            <TableHead className="text-[11px] h-9 text-slate-500">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {logs?.bookings?.length ? (
                            logs.bookings.map((book: any) => (
                              <TableRow key={book.id} className="hover:bg-slate-50/50 transition-colors border-slate-50">
                                <TableCell className="py-2">
                                  <div>
                                    <p className="font-semibold text-xs text-slate-700">
                                      {book.member?.Name || "Guest"}
                                    </p>
                                    <p className="text-[10px] text-slate-400">
                                      {book.member?.Membership_No || "-"}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs py-2 text-slate-600">
                                  {format(new Date(book.bookingDate), "LLL dd, y")}
                                  {book.endDate && book.endDate !== book.bookingDate && ` - ${format(new Date(book.endDate), "LLL dd, y")}`}
                                </TableCell>
                                <TableCell className="text-xs py-2 text-slate-600 font-semibold">
                                  {book.bookingTime}
                                </TableCell>
                                <TableCell className="py-2">
                                  <Badge
                                    variant="secondary"
                                    className={cn(
                                      "capitalize text-[9px] font-semibold px-2 py-0 h-4 bg-slate-100 text-slate-600 border-none shadow-none"
                                    )}
                                  >
                                    {book.paymentStatus?.toLowerCase()}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell
                                colSpan={4}
                                className="text-center py-10 text-slate-400"
                              >
                                <div className="flex flex-col items-center gap-1.5">
                                  <DoorOpen className="h-6 w-6 opacity-10" />
                                  <p className="text-[11px]">No bookings found.</p>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  <TabsContent value="maintenance" className="mt-0 outline-none">
                    <div className="border border-slate-100 rounded-lg overflow-hidden bg-white">
                      <Table>
                        <TableHeader className="bg-slate-50/50">
                          <TableRow className="hover:bg-transparent border-slate-100">
                            <TableHead className="text-[11px] h-9 text-slate-500">Date Range</TableHead>
                            <TableHead className="text-[11px] h-9 text-slate-500">Reason</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {logs?.outOfOrders?.length ? (
                            logs.outOfOrders.map((oo: any) => (
                              <TableRow key={oo.id} className="hover:bg-slate-50/50 transition-colors border-slate-50">
                                <TableCell className="text-xs py-2 text-slate-600">
                                  {format(new Date(oo.startDate), "LLL dd, y")} -{" "}
                                  {format(new Date(oo.endDate), "LLL dd, y")}
                                </TableCell>
                                <TableCell className="text-xs py-2 text-slate-600">
                                  <div className="flex items-center gap-1.5">
                                    <Settings className="h-3 w-3 text-slate-300" />
                                    {oo.reason}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell
                                colSpan={2}
                                className="text-center py-10 text-slate-400"
                              >
                                <div className="flex flex-col items-center gap-1.5">
                                  <Settings className="h-6 w-6 opacity-10" />
                                  <p className="text-[11px]">No maintenance records.</p>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                </>
              )}
            </div>
          </Tabs>
        </div>
        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose}>Close Details</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default function Lawns() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editLawn, setEditLawn] = useState<any>(null);
  const [deleteLawnItem, setDeleteLawnItem] = useState<any>(null);
  const [reserveDialog, setReserveDialog] = useState(false);

  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [selectedLawns, setSelectedLawns] = useState<number[]>([]);
  const [reserveDates, setReserveDates] = useState({
    from: new Date().toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("MORNING");
  const [reserveRemarks, setReserveRemarks] = useState("");

  const [form, setForm] = useState<LawnForm>(initialFormState);
  const [newOutOfOrder, setNewOutOfOrder] = useState<LawnOutOfOrder>(initialOutOfOrderState);
  const [editForm, setEditForm] = useState<any>({ ...initialFormState, id: "" });
  const [editNewOutOfOrder, setEditNewOutOfOrder] = useState<LawnOutOfOrder>(initialOutOfOrderState);

  // Detail Dialog states
  const [detailLawn, setDetailLawn] = useState<Lawn | null>(null);
  const [detailLogs, setDetailLogs] = useState<any>(null);
  const [logLoading, setLogLoading] = useState(false);
  const [detailDateRange, setDetailDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
  });
  const [activeTab, setActiveTab] = useState("reservations");

  const { data: lawns = [], isLoading: isLoadingLawns } = useQuery({ queryKey: ["lawns"], queryFn: getLawns });
  const { data: lawnCategories = [] } = useQuery({ queryKey: ["lawnCategories"], queryFn: getLawnCategories });

  const fetchLogs = useCallback(async () => {
    if (!detailLawn || !detailDateRange?.from || !detailDateRange?.to) return;
    setLogLoading(true);
    try {
      const data = await getLawnLogs(
        detailLawn.id,
        detailDateRange.from.toISOString(),
        detailDateRange.to.toISOString()
      );
      setDetailLogs(data);
    } catch (error) {
      toast({ title: "Failed to fetch logs", variant: "destructive" });
    } finally {
      setLogLoading(false);
    }
  }, [detailLawn, detailDateRange, toast]);

  useEffect(() => {
    if (detailLawn) fetchLogs();
  }, [detailLawn, detailDateRange, fetchLogs]);

  const createMutation = useMutation({
    mutationFn: (data: any) => createLawn({ ...data, lawnCategoryId: Number(data.lawnCategoryId) }),
    onSuccess: () => {
      toast({ title: "Lawn created" });
      queryClient.invalidateQueries({ queryKey: ["lawns"] });
      setIsAddOpen(false);
      setForm(initialFormState);
    },
    onError: (err: any) => toast({ title: "Failed to create", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => updateLawn({ ...data, id: Number(data.id), lawnCategoryId: Number(data.lawnCategoryId) }),
    onSuccess: () => {
      toast({ title: "Lawn updated" });
      queryClient.invalidateQueries({ queryKey: ["lawns"] });
      setEditLawn(null);
    },
    onError: (err: any) => toast({ title: "Failed to update", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLawn,
    onSuccess: () => {
      toast({ title: "Deleted" });
      queryClient.invalidateQueries({ queryKey: ["lawns"] });
      setDeleteLawnItem(null);
    },
  });

  const reserveMutation = useMutation({
    mutationFn: (data: any) => reserveLawn(data.lawnIds, data.reserve, data.timeSlot, data.reserveFrom, data.reserveTo),
    onSuccess: (data) => {
      toast({ title: "Success", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["lawns"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (editLawn) {
      setEditForm({
        id: editLawn.id,
        lawnCategoryId: editLawn.lawnCategoryId.toString(),
        description: editLawn.description || "",
        minGuests: editLawn.minGuests.toString(),
        maxGuests: editLawn.maxGuests.toString(),
        memberCharges: editLawn.memberCharges.toString(),
        guestCharges: editLawn.guestCharges.toString(),
        isActive: editLawn.isActive,
        isOutOfService: editLawn.isOutOfService,
        outOfOrders: editLawn.outOfOrders?.map((p: any) => ({
          ...p,
          startDate: p.startDate.split("T")[0],
          endDate: p.endDate.split("T")[0],
        })) || [],
      });
    }
  }, [editLawn]);

  useEffect(() => {
    if (reserveDialog && reserveDates.from && reserveDates.to && selectedTimeSlot) {
      const selectedFrom = getDaySortKey(reserveDates.from);
      const selectedTo = getDaySortKey(reserveDates.to);
      const reserved = lawns.filter((l: Lawn) =>
        l.reservations?.some(r =>
          getDaySortKey(r.reservedFrom) === selectedFrom &&
          getDaySortKey(r.reservedTo) === selectedTo &&
          r.timeSlot === selectedTimeSlot
        )
      ).map((l: Lawn) => l.id);
      setSelectedLawns(reserved);
    }
  }, [reserveDialog, reserveDates, selectedTimeSlot, lawns]);

  const categories = useMemo(() => Array.from(new Set(lawns.map((l: any) => l.lawnCategory?.category).filter(Boolean))), [lawns]);
  const filteredLawns = useMemo(() => categoryFilter === "ALL" ? lawns : lawns.filter((l: any) => l.lawnCategory?.category === categoryFilter), [lawns, categoryFilter]);

  const getTimeSlotIcon = (slot: string) => {
    if (slot === "MORNING") return <Sun className="h-4 w-4 text-yellow-500" />;
    if (slot === "EVENING") return <Sunset className="h-4 w-4 text-orange-500" />;
    return <Moon className="h-4 w-4 text-blue-500" />;
  };

  const handleBulkReserve = () => {
    if (!reserveDates.from || !reserveDates.to) return;
    const sFrom = getDaySortKey(reserveDates.from);
    const sTo = getDaySortKey(reserveDates.to);
    const currentlyReserved = lawns.filter((l: Lawn) => l.reservations?.some(r => getDaySortKey(r.reservedFrom) === sFrom && getDaySortKey(r.reservedTo) === sTo && r.timeSlot === selectedTimeSlot)).map((l: Lawn) => l.id);
    const toReserve = selectedLawns.filter(id => !currentlyReserved.includes(id));
    const toUnreserve = currentlyReserved.filter(id => !selectedLawns.includes(id));
    if (toReserve.length > 0) reserveMutation.mutate({ lawnIds: toReserve, reserve: true, reserveFrom: reserveDates.from, reserveTo: reserveDates.to, timeSlot: selectedTimeSlot, remarks: reserveRemarks });
    if (toUnreserve.length > 0) reserveMutation.mutate({ lawnIds: toUnreserve, reserve: false, reserveFrom: reserveDates.from, reserveTo: reserveDates.to, timeSlot: selectedTimeSlot, remarks: reserveRemarks });
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold">Lawn Management</h1>
          <p className="text-muted-foreground">Manage lawn categories, status, and reservations</p>
        </div>

        <div className="flex gap-3">
          <div className="flex justify-end gap-4">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-64"><SelectValue placeholder="All Categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                {categories.map((c: any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" className="gap-2 border-orange-200 bg-orange-50 text-orange-700" onClick={() => setReserveDialog(true)}>
            <CalendarIcon className="h-4 w-4" /> Reservations
          </Button>
          <Button onClick={() => { setForm(initialFormState); setIsAddOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Add Lawn
          </Button>
        </div>


      </div>


      <Card>
        <CardContent className="p-0">
          {isLoadingLawns ? <div className="p-20 text-center"><Loader2 className="animate-spin inline mr-2" /> Loading...</div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Charges (Member/Guest)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Maintenance</TableHead>
                  <TableHead>Upcoming Reservations</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLawns.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-semibold">{l.lawnCategory?.category}</TableCell>
                    <TableCell>{l.minGuests} - {l.maxGuests}</TableCell>
                    <TableCell>PKR {Number(l.memberCharges).toLocaleString()} / {Number(l.guestCharges).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={getLawnStatusVariant(getLawnStatus(l)) as any} className={cn(
                        getLawnStatus(l) === "Available" ? "bg-emerald-600 text-white" :
                          getLawnStatus(l) === "On Hold" ? "bg-amber-500 text-white border-amber-600" : ""
                      )}>
                        {getLawnStatus(l)}
                      </Badge>
                    </TableCell>
                    <TableCell><MaintenanceIndicator outOfOrders={l.outOfOrders} isOutOfService={l.isOutOfService} /></TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {l.reservations?.filter((r: any) => new Date(r.reservedFrom).getTime() >= new Date().setUTCHours(0, 0, 0, 0))
                          .sort((a: any, b: any) => new Date(a.reservedFrom).getTime() - new Date(b.reservedFrom).getTime())
                          .slice(0, 2).map((r: any) => (
                            <div key={r.id} className="text-[10px] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 flex items-center gap-1">
                              {getTimeSlotIcon(r.timeSlot)} {formatDate(r.reservedFrom)} - {formatDate(r.reservedTo)}
                            </div>
                          ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                          onClick={() => setDetailLawn(l)}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-blue-600"
                          onClick={() => setEditLawn(l)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeleteLawnItem(l)}
                        >
                          <Trash2 className="h-4 w-4" />
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

      {/* Reservation Dialog */}
      <Dialog open={reserveDialog} onOpenChange={(open) => {
        setReserveDialog(open);
        if (!open) {
          setSelectedLawns([]);
          setReserveRemarks("");
        }
      }}>
        <DialogContent className="max-w-7xl">
          <DialogHeader><DialogTitle>Bulk Reservations</DialogTitle></DialogHeader>
          <div className="flex flex-col md:flex-row gap-4 p-4 bg-muted/40 rounded-lg items-end">
            <div className="flex-1">
              <Label className="text-xs font-semibold">Select Date Range</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal h-10 bg-white border-input shadow-sm mt-1",
                      !reserveDates.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {reserveDates.from ? (
                      reserveDates.to && reserveDates.to !== reserveDates.from ? (
                        <>
                          {format(new Date(reserveDates.from), "LLL dd, y")} -{" "}
                          {format(new Date(reserveDates.to), "LLL dd, y")}
                        </>
                      ) : (
                        format(new Date(reserveDates.from), "LLL dd, y")
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
                    defaultMonth={reserveDates.from ? new Date(reserveDates.from) : new Date()}
                    selected={{
                      from: reserveDates.from ? new Date(reserveDates.from) : undefined,
                      to: reserveDates.to ? new Date(reserveDates.to) : undefined,
                    }}
                    onSelect={(range) => {
                      if (range?.from) {
                        const fromStr = format(range.from, "yyyy-MM-dd");
                        const toStr = range.to ? format(range.to, "yyyy-MM-dd") : fromStr;
                        setReserveDates({ from: fromStr, to: toStr });
                      } else {
                        setReserveDates({ from: "", to: "" });
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
            </div>
            <div className="w-full md:w-[300px]">
              <Label className="text-xs font-semibold">Time Slot</Label>
              <Select value={selectedTimeSlot} onValueChange={setSelectedTimeSlot}>
                <SelectTrigger className="mt-1 h-10 bg-white shadow-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MORNING">Morning (8:00 AM - 1:00 PM)</SelectItem>
                  <SelectItem value="EVENING">Evening (2:00 PM - 7:00 PM)</SelectItem>
                  <SelectItem value="NIGHT">Night (8:00 PM - 1:00 AM)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label className="text-xs font-semibold">Reservation Remarks</Label>
              <Input
                className="mt-1 h-10 bg-white shadow-sm"
                placeholder="Optional remarks (e.g. Member name, Event type)"
                value={reserveRemarks}
                onChange={(e) => setReserveRemarks(e.target.value)}
              />
            </div>
          </div>
          {reserveDates.from && reserveDates.to && getDaySortKey(reserveDates.from) > getDaySortKey(reserveDates.to) && (
            <div className="px-4 py-2 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-red-700 text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>End date cannot be before start date.</span>
            </div>
          )}

          <div className="max-h-[50vh] overflow-auto border rounded-md">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-12 text-center">
                    <Checkbox
                      checked={selectedLawns.length === filteredLawns.length && filteredLawns.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          const nonConflicted = filteredLawns
                            .filter(l => {
                              const mFrom = getDaySortKey(reserveDates.from);
                              const mTo = getDaySortKey(reserveDates.to);
                              const hasMaintenance = l.outOfOrders?.some(oo => {
                                const s = getDaySortKey(oo.startDate);
                                const e = getDaySortKey(oo.endDate);
                                return s <= mTo && e >= mFrom;
                              });
                              const hasBooking = l.bookings?.some(b => {
                                const d = getDaySortKey(b.bookingDate);
                                return d >= mFrom && d <= mTo && b.bookingTime === selectedTimeSlot;
                              });
                              return !hasMaintenance && !hasBooking;
                            })
                            .map(l => l.id);
                          setSelectedLawns(nonConflicted);
                        } else {
                          setSelectedLawns([]);
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Lawn Detail</TableHead>
                  <TableHead>Availability Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLawns.map((l: Lawn) => {
                  const mFrom = getDaySortKey(reserveDates.from);
                  const mTo = getDaySortKey(reserveDates.to);

                  const activeReservation = l.reservations?.find(r =>
                    getDaySortKey(r.reservedFrom) === mFrom &&
                    getDaySortKey(r.reservedTo) === mTo &&
                    r.timeSlot === selectedTimeSlot
                  );

                  const overlappingReservation = l.reservations?.find(r => {
                    const rFrom = getDaySortKey(r.reservedFrom);
                    const rTo = getDaySortKey(r.reservedTo);
                    return rFrom <= mTo && rTo >= mFrom && r.timeSlot === selectedTimeSlot &&
                      !(rFrom === mFrom && rTo === mTo);
                  });

                  const hasMaintenance = l.outOfOrders?.find(oo => {
                    const s = getDaySortKey(oo.startDate);
                    const e = getDaySortKey(oo.endDate);
                    return s <= mTo && e >= mFrom;
                  });

                  const hasBooking = l.bookings?.find(b => {
                    const s = getDaySortKey(b.bookingDate);
                    const e = getDaySortKey(b.endDate);
                    return s <= mTo && e >= mFrom && b.bookingTime === selectedTimeSlot;
                  });

                  const isConflicted = hasMaintenance || hasBooking || overlappingReservation;
                  const isAlreadySelected = activeReservation;

                  return (
                    <TableRow key={l.id} className={activeReservation ? "bg-blue-50/50" : isConflicted ? "bg-red-50/30 opacity-80" : ""}>
                      <TableCell className="text-center">
                        <Checkbox
                          disabled={!!isConflicted && !activeReservation}
                          checked={selectedLawns.includes(l.id)}
                          onCheckedChange={checked => setSelectedLawns(prev => checked ? [...prev, l.id] : prev.filter(id => id !== l.id))}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{l.lawnCategory?.category}</div>
                        <div className="text-[10px] text-muted-foreground">{l.description || "No description"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {activeReservation && (
                            <div className="flex flex-col gap-1">
                              <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200 w-fit">Reserved by you</Badge>
                              {activeReservation.remarks && (
                                <div className="text-[10px] text-blue-600 font-medium italic truncate max-w-[150px]" title={activeReservation.remarks}>
                                  "{activeReservation.remarks}"
                                </div>
                              )}
                            </div>
                          )}
                          {hasMaintenance && (
                            <div className="flex items-center gap-1.5 text-[10px] text-red-600 font-medium">
                              <AlertCircle className="h-3 w-3" />
                              Maintenance: {hasMaintenance.reason}
                            </div>
                          )}
                          {hasBooking && (
                            <div className="flex items-center gap-1.5 text-[10px] text-red-600 font-medium">
                              <AlertCircle className="h-3 w-3" />
                              Booked by member
                            </div>
                          )}
                          {overlappingReservation && (
                            <div className="flex items-center gap-1.5 text-[10px] text-red-600 font-medium">
                              <AlertCircle className="h-3 w-3" />
                              Overlapping Reservation
                            </div>
                          )}
                          {!isConflicted && !activeReservation && (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50/50 w-fit">Available</Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredLawns.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No lawns found match the criteria.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="gap-2">
            <div className="flex-1 text-xs text-muted-foreground flex items-center gap-2">
              {(() => {
                const sFrom = getDaySortKey(reserveDates.from);
                const sTo = getDaySortKey(reserveDates.to);
                const currentlyReserved = lawns.filter((l: Lawn) => l.reservations?.some(r => getDaySortKey(r.reservedFrom) === sFrom && getDaySortKey(r.reservedTo) === sTo && r.timeSlot === selectedTimeSlot)).map((l: Lawn) => l.id);
                const toReserve = selectedLawns.filter(id => !currentlyReserved.includes(id));
                const toUnreserve = currentlyReserved.filter(id => !selectedLawns.includes(id));
                return (
                  <>
                    {toReserve.length > 0 && <span className="text-emerald-600">{toReserve.length} to reserve</span>}
                    {toReserve.length > 0 && toUnreserve.length > 0 && <span>•</span>}
                    {toUnreserve.length > 0 && <span className="text-red-600">{toUnreserve.length} to unreserve</span>}
                    {toReserve.length === 0 && toUnreserve.length === 0 && <span>No changes to make</span>}
                  </>
                );
              })()}
            </div>
            <Button variant="outline" onClick={() => setReserveDialog(false)}>Close</Button>
            <Button
              onClick={handleBulkReserve}
              disabled={(() => {
                if (reserveMutation.isPending) return true;
                if (reserveDates.from && reserveDates.to && getDaySortKey(reserveDates.from) > getDaySortKey(reserveDates.to)) return true;
                const sFrom = getDaySortKey(reserveDates.from);
                const sTo = getDaySortKey(reserveDates.to);
                const currentlyReserved = lawns.filter((l: Lawn) => l.reservations?.some(r => getDaySortKey(r.reservedFrom) === sFrom && getDaySortKey(r.reservedTo) === sTo && r.timeSlot === selectedTimeSlot)).map((l: Lawn) => l.id);
                const toReserve = selectedLawns.filter(id => !currentlyReserved.includes(id));
                const toUnreserve = currentlyReserved.filter(id => !selectedLawns.includes(id));
                return toReserve.length === 0 && toUnreserve.length === 0;
              })()}
            >
              {reserveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm Action
            </Button>
          </DialogFooter>


        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-7xl h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add New Lawn</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2">
              <Label>Category</Label>
              <Select value={form.lawnCategoryId} onValueChange={v => setForm(p => ({ ...p, lawnCategoryId: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {lawnCategories.map((c: any) => <SelectItem key={c.id} value={c.id.toString()}>{c.category}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Min Guests</Label>
              <Input type="number" value={form.minGuests} onChange={e => setForm(p => ({ ...p, minGuests: e.target.value }))} />
            </div>
            <div>
              <Label>Max Guests</Label>
              <Input type="number" value={form.maxGuests} onChange={e => setForm(p => ({ ...p, maxGuests: e.target.value }))} />
            </div>
            <div>
              <Label>Member Price</Label>
              <Input type="number" value={form.memberCharges} onChange={e => setForm(p => ({ ...p, memberCharges: e.target.value }))} />
            </div>
            <div>
              <Label>Guest Price</Label>
              <Input type="number" value={form.guestCharges} onChange={e => setForm(p => ({ ...p, guestCharges: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <OutOfOrderPeriods
                periods={form.outOfOrders}
                newPeriod={newOutOfOrder}
                onNewPeriodChange={setNewOutOfOrder}
                onAddPeriod={() => {
                  setForm(p => ({ ...p, outOfOrders: [...p.outOfOrders, newOutOfOrder] }));
                  setNewOutOfOrder(initialOutOfOrderState);
                }}
                onRemovePeriod={(i) => setForm(p => ({ ...p, outOfOrders: p.outOfOrders.filter((_, idx) => idx !== i) }))}
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={form.isActive} onCheckedChange={c => setForm(p => ({ ...p, isActive: c }))} />
                <Label>Active</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(form)}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editLawn} onOpenChange={() => setEditLawn(null)}>
        <DialogContent className="max-w-7xl h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Lawn</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2">
              <Label>Category</Label>
              <Select value={editForm.lawnCategoryId} onValueChange={v => setEditForm(p => ({ ...p, lawnCategoryId: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {lawnCategories.map((c: any) => <SelectItem key={c.id} value={c.id.toString()}>{c.category}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Min Guests</Label>
              <Input type="number" value={editForm.minGuests} onChange={e => setEditForm(p => ({ ...p, minGuests: e.target.value }))} />
            </div>
            <div>
              <Label>Max Guests</Label>
              <Input type="number" value={editForm.maxGuests} onChange={e => setEditForm(p => ({ ...p, maxGuests: e.target.value }))} />
            </div>
            <div>
              <Label>Member Price</Label>
              <Input type="number" value={editForm.memberCharges} onChange={e => setEditForm(p => ({ ...p, memberCharges: e.target.value }))} />
            </div>
            <div>
              <Label>Guest Price</Label>
              <Input type="number" value={editForm.guestCharges} onChange={e => setEditForm(p => ({ ...p, guestCharges: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <Textarea value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <OutOfOrderPeriods
                periods={editForm.outOfOrders}
                newPeriod={editNewOutOfOrder}
                onNewPeriodChange={setEditNewOutOfOrder}
                onAddPeriod={() => {
                  setEditForm(p => ({ ...p, outOfOrders: [...p.outOfOrders, editNewOutOfOrder] }));
                  setEditNewOutOfOrder(initialOutOfOrderState);
                }}
                onRemovePeriod={(i) => setEditForm(p => ({ ...p, outOfOrders: p.outOfOrders.filter((_, idx) => idx !== i) }))}
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={editForm.isActive} onCheckedChange={c => setEditForm(p => ({ ...p, isActive: c }))} />
                <Label>Active</Label>
              </div>

            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLawn(null)}>Cancel</Button>
            <Button onClick={() => updateMutation.mutate(editForm)}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteLawnItem} onOpenChange={() => setDeleteLawnItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Lawn</DialogTitle></DialogHeader>
          <div className="py-4 text-muted-foreground">Are you sure you want to delete this lawn? This action cannot be undone.</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteLawnItem(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate(deleteLawnItem.id)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LawnDetailDialog
        lawn={detailLawn}
        onClose={() => setDetailLawn(null)}
        logs={detailLogs}
        loading={logLoading}
        dateRange={detailDateRange}
        activeTab={activeTab}
        onDateRangeChange={setDetailDateRange}
        onTabChange={setActiveTab}
      />
    </div>
  );
}