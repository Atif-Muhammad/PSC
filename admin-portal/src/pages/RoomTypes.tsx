import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, PencilLine, FileDown } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { exportRoomTypesReport } from "@/lib/pdfExport";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createRoomType, deleteRoomType, getRoomTypes, updateRoomType,
} from "../../config/apis";

export default function RoomTypes() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editType, setEditType] = useState<any>(null);
  const [deleteType, setDeleteType] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    type: "",
    priceMember: "",
    priceGuest: "",
  });

  const [editFormData, setEditFormData] = useState({
    type: "",
    priceMember: "",
    priceGuest: "",
  });

  // --- Queries ---
  const { data: roomTypes = [] } = useQuery({
    queryKey: ["roomTypes"],
    queryFn: getRoomTypes,
  });

  // --- Mutations ---
  const createMutation = useMutation({
    mutationFn: createRoomType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roomTypes"] });
      toast({ title: "Room type added" });
      setIsAddOpen(false);
      setFormData({ type: "", priceMember: "", priceGuest: "" });
    },
    onError: () => toast({ title: "Failed to add room type", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateRoomType(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roomTypes"] });
      toast({ title: "Room type updated" });
      setEditType(null);
    },
    onError: () => toast({ title: "Failed to update room type", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteRoomType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roomTypes"] });
      toast({ title: "Room type deleted" });
      setDeleteType(null);
    },
    onError: () => toast({ title: "Failed to delete room type", variant: "destructive" }),
  });

  // --- Handlers ---
  const handleAdd = () => {
    if (!formData.type || !formData.priceMember || !formData.priceGuest) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      type: formData.type,
      priceMember: formData.priceMember,
      priceGuest: formData.priceGuest,
    });
  };

  const handleEdit = (type: any) => {
    setEditType(type);
    setEditFormData({
      type: type.type,
      priceMember: type.priceMember,
      priceGuest: type.priceGuest,
    });
  };

  const handleUpdate = () => {
    if (!editType) return;
    updateMutation.mutate({
      id: editType.id,
      data: {
        type: editFormData.type,
        priceMember: editFormData.priceMember,
        priceGuest: editFormData.priceGuest,
      },
    });
  };

  return (
    <div className="space-y-6 animate-fade-in overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Room Types</h2>
          <p className="text-muted-foreground">Manage room categories and pricing</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportRoomTypesReport(roomTypes)} className="gap-2">
            <FileDown className="h-4 w-4" /> Export PDF
          </Button>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Add Room Type
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Room Type</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Type Name</Label>
                  <Input
                    value={formData.type}
                    onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Member Price (PKR)</Label>
                  <Input
                    type="number"
                    value={formData.priceMember}
                    onChange={(e) => setFormData((prev) => ({ ...prev, priceMember: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Guest Price (PKR)</Label>
                  <Input
                    type="number"
                    value={formData.priceGuest}
                    onChange={(e) => setFormData((prev) => ({ ...prev, priceGuest: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button onClick={handleAdd}>Add</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Member Price</TableHead>
                <TableHead>Guest Price</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roomTypes.map((type: any) => (
                <TableRow key={type.id}>
                  <TableCell>{type.type}</TableCell>
                  <TableCell>PKR {type.priceMember}</TableCell>
                  <TableCell>PKR {type.priceGuest}</TableCell>
                  <TableCell className="text-right flex justify-end gap-2">
                    <Button size="icon" onClick={() => handleEdit(type)}>
                      <PencilLine className="w-4 h-4" />
                    </Button>
                    <Button variant="destructive" size="icon" onClick={() => setDeleteType(type)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editType} onOpenChange={() => setEditType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Room Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Type Name</Label>
              <Input
                value={editFormData.type}
                onChange={(e) => setEditFormData((p) => ({ ...p, type: e.target.value }))}
              />
            </div>
            <div>
              <Label>Member Price</Label>
              <Input
                type="number"
                value={editFormData.priceMember}
                onChange={(e) => setEditFormData((p) => ({ ...p, priceMember: e.target.value }))}
              />
            </div>
            <div>
              <Label>Guest Price</Label>
              <Input
                type="number"
                value={editFormData.priceGuest}
                onChange={(e) => setEditFormData((p) => ({ ...p, priceGuest: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditType(null)}>Cancel</Button>
            <Button onClick={handleUpdate}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteType} onOpenChange={() => setDeleteType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Room Type</DialogTitle>
          </DialogHeader>
          <p className="py-4">Are you sure you want to delete <strong>{deleteType?.type}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteType(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate(deleteType.id)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
