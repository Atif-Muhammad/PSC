
import axios from "axios";
import { promises } from "dns";
const base_url = "http://localhost:3000";

export const authAdmin = async (data: any) => {
  try {
    const response = await axios.post(`${base_url}/auth/login/admin`, data, {
      withCredentials: true,
      headers: {
        "Client-Type": "web",
      },
    });
    return response;
  } catch (error: any) {
    throw new Error(error);
  }
};
export const logout = async () => {
  try {
    const response = await axios.post(`${base_url}/auth/logout`, {}, {
      withCredentials: true,
      headers: {
        "Client-Type": "web",
      },
    });
    return response;
  } catch (error: any) {
    throw new Error(error);
  }
};

export const userWho = async () => {
  try {
    const response = await axios.get(`${base_url}/auth/user-who`, {
      withCredentials: true,
      headers: {
        "Client-Type": "web",
      },
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error);
  }
};
//////////////////////////////////////////////////////////////////////////////////////////////////////

export const getAdmins = async (): Promise<any>=> {
  try {
    const response: {data: any[]} = await axios.get(`${base_url}/admin/get/admins`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error);
  }
};
export const createAdmin = async (data: any) => {
  try {
    const response = await axios.post(`${base_url}/auth/create/admin`, data, {
      withCredentials: true,
    });
    return response;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const updateAdmin = async ({ adminID, ...updates }: {adminID: any, updates: any}) => {
  try {
    // console.log(updates)
    const response = await axios.patch(
      `${base_url}/auth/update/admin?adminID=${adminID}`,
      updates,
      { withCredentials: true }
    );
    return response.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteAdmin = async (adminID: any) => {
  try {
    const response = await axios.delete(
      `${base_url}/auth/remove/admin?adminID=${adminID}`,
      { withCredentials: true }
    );
    return response.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

////////////////////////////////////////// members ///////////////////////////////////////////////////

// api/admin.ts
export const getMembers = async ({
  pageParam = 1,
  search,
  status,
}: {
  pageParam?: number;
  search?: string;
  status?: string;
}): Promise<any> => {
  const params = new URLSearchParams({
    page: pageParam.toString(),
    limit: "50",
  });

  if (search) params.append("search", search);
  if (status) params.append("status", status);

  const res = await axios.get(`${base_url}/admin/get/members?${params.toString()}`);
  if (res.status != 200) throw new Error("Failed to fetch members");
  return res.data
};

export const createMember = async (data: any) => {
  try {
    const response = await axios.post(`${base_url}/admin/create/member`, data, {
      withCredentials: true,
    });
    return response;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const updateMember = async ({ Membership_No, ...updates }: {Membership_No: any, updates: any}): Promise<any> => {
  try {
    const response = await axios.patch(
      `${base_url}/admin/update/member?memberID=${Membership_No}`,
      updates.updates,
      { withCredentials: true }
    );
    return response.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const deleteMember = async (memberID: any): Promise<any> => {
  try {
    const response = await axios.delete(
      `${base_url}/admin/remove/member?memberID=${memberID}`,
      { withCredentials: true }
    );
    return response.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const createBulkMembers = async (data: any): Promise<any> => {
  try {
    const response = await axios.post(
      `${base_url}/admin/create/bulk/members`,
      data,
      { withCredentials: true }
    );
    console.log(response);
    return response;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const searchMembers = async (searchString: any): Promise<any> => {
  try {
    const response = await axios.get(
      `${base_url}/admin/search/members?searchFor=${searchString}`,
      { withCredentials: true }
    );
    return response;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

// Bookings
export const getBookings = async (bookingsFor: any) => {
  try {
    const response = await axios.get(
      `${base_url}/admin/get/bookings/all?bookingsFor=${bookingsFor}`,
      { withCredentials: true }
    );
    return response.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const createBooking = async (data: any) => {
  // console.log(data)
  try {
    const response = await axios.post(
      `${base_url}/admin/create/booking`,
      data,
      { withCredentials: true }
    );
    return response.data;
  } catch (error: any) {
    // console.log(error)
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};
export const updateBooking = async (data: any) => {
  try {
    const response = await axios.patch(
      `${base_url}/admin/update/booking`,
      data,
      { withCredentials: true }
    );
    return response;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const deleteBooking = async (bookID: any) => {
  try {
    const response = await axios.delete(
      `${base_url}/admin/delete/booking?bookID=${bookID}`,
      { withCredentials: true }
    );
    return response;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

// rooms
export const getRoomTypes = async (): Promise<any> => {
  try {
    const response = await axios.get(`${base_url}/admin/get/roomTypes`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const createRoomType = async (data: any): Promise<any> => {
  try {
    const response = await axios.post(
      `${base_url}/admin/create/roomType`,
      data,
      { withCredentials: true }
    );
    return response;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const updateRoomType = async (id: string | number, data: any): Promise<any> => {
  try {
    const response = await axios.patch(
      `${base_url}/admin/update/roomType?id=${id}`,
      data,
      { withCredentials: true }
    );
    return response.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteRoomType = async (id: string | number): Promise<any> => {
  try {
    const response = await axios.delete(
      `${base_url}/admin/delete/roomType?id=${id}`,
      { withCredentials: true }
    );
    return response.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const createRoom = async (data: any) => {
  try {
    const response = await axios.post(`${base_url}/admin/create/room`, data, {
      withCredentials: true,
    });
    return response;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const getAvailRooms = async (roomTypeId: any) => {
  try {
    const response = await axios.get(`${base_url}/admin/get/rooms/available?roomTypeId=${roomTypeId}`, {
      withCredentials: true,
    });
    return response;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const getRoomCategories = async () => {
  try {
    const response = await axios.get(`${base_url}/admin/get/rooms/categories`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const getRooms = async () => {
  try {
    const response = await axios.get(`${base_url}/admin/get/rooms`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const updateRoom = async (data: any) => {
  try {
    const response = await axios.patch(`${base_url}/admin/update/room`, data, {
      withCredentials: true,
    });
    return response;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    console.log(error);
    throw { message, status: error.response?.status || 500 };
  }
};
export const deleteRoom = async () => {};

// halls

export const createHall = async (data: any) => {
  try {
    const response = await axios.post(`${base_url}/admin/create/hall`, data, {
      withCredentials: true,
    });
    return response;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const getHallTypes = async () => {
  try {
    const response = await axios.get(`${base_url}/admin/get/halls/available`, {
      withCredentials: true,
    });
    return response;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const getHalls = async () => {
  try {
    const response = await axios.get(`${base_url}/admin/get/halls`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const updateHall = async (data: any) => {
  try {
    const response = await axios.patch(`${base_url}/admin/update/hall`, data, {
      withCredentials: true,
    });
    return response;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    console.log(error);
    throw { message, status: error.response?.status || 500 };
  }
};
export const deleteHall = async () => {};

// lawns

export const getLawnCategoriesNames = async (catId: any) => {
  try {
    const response = await axios.get(`${base_url}/admin/get/lawn/categories/names?catId=${catId}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const getLawnCategories = async () => {
  try {
    const response = await axios.get(`${base_url}/admin/get/lawn/categories`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const createLawnCategory = async (data: any) => {
  try {
    const response = await axios.post(
      `${base_url}/admin/create/lawn/category`,
      data,
      {
        withCredentials: true,
      }
    );
    return response;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const updateLawnCategory = async (data: any) => {
  try {
    const response = await axios.patch(
      `${base_url}/admin/update/lawn/category`,
      data,
      {
        withCredentials: true,
      }
    );
    return response;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const deleteLawnCategory = async (catID: any) => {
  try {
    const response = await axios.delete(
      `${base_url}/admin/delete/lawn/category?catID=${catID}`,
      {
        withCredentials: true,
      }
    );
    return response;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

export const createLawn = async (data: any) => {
  try {
    const response = await axios.post(`${base_url}/admin/create/lawn`, data, {
      withCredentials: true,
    });
    return response;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const getAvailableLawns = async (catId: any) => {
  try {
    const response = await axios.get(`${base_url}/admin/get/lawns/available?catId=${catId}`, {
      withCredentials: true,
    });
    return response;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const getLawns = async () => {
  try {
    const response = await axios.get(`${base_url}/admin/get/lawns`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const updateLawn = async (data: any) => {
  try {
    const response = await axios.patch(`${base_url}/admin/update/lawn`, data, {
      withCredentials: true,
    });
    return response;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    console.log(error);
    throw { message, status: error.response?.status || 500 };
  }
};
export const deleteLawn = async () => {};

// photoshoot
export const createPhotoshoot = async (data: any) => {
  try {
    const response = await axios.post(
      `${base_url}/admin/create/photoShoot`,
      data,
      {
        withCredentials: true,
      }
    );
    return response;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const getPhotoshootsAvail = async () => {
  try {
    const response = await axios.get(`${base_url}/admin/get/photoShoots/available`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const getPhotoshoots = async () => {
  try {
    const response = await axios.get(`${base_url}/admin/get/photoShoots`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const updatePhotoshoot = async (data: any) => {
  try {
    const response = await axios.patch(
      `${base_url}/admin/update/photoShoot`,
      data,
      {
        withCredentials: true,
      }
    );
    return response;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    // console.log(error);
    throw { message, status: error.response?.status || 500 };
  }
};
export const deletePhotoshoot = async () => {};

// sports
export const createSport = async (data: any) => {
  try {
    const response = await axios.post(`${base_url}/admin/create/sport`, data, {
      withCredentials: true,
    });
    return response;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const getSportsTypes = async () => {
  try {
    const response = await axios.get(`${base_url}/admin/get/sports/names`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const getSportCharges = async () => {
  try {
    const response = await axios.get(`${base_url}/admin/get/sports/names`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const getSports = async () => {
  try {
    const response = await axios.get(`${base_url}/admin/get/sports`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

export const updateSport = async (data: any) => {
  try {
    const response = await axios.patch(`${base_url}/admin/update/sport`, data, {
      withCredentials: true,
    });
    return response;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    console.log(error);
    throw { message, status: error.response?.status || 500 };
  }
};
export const deleteSport = async () => {};
