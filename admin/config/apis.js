import axios from "axios";
const base_url = "http://localhost:3000";

export const authAdmin = async (data) => {
  try {
    const response = await axios.post(`${base_url}/auth/login/admin`, data, {
      withCredentials: true,
      headers: {
        "Client-Type": "web",
      },
    });
    return response;
  } catch (error) {
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
  } catch (error) {
    throw new Error(error);
  }
};
//////////////////////////////////////////////////////////////////////////////////////////////////////

export const getAdmins = async () => {
  try {
    const response = await axios.get(`${base_url}/admin/get/admins`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    throw new Error(error);
  }
};
export const createAdmin = async (data) => {
  try {
    const response = await axios.post(`${base_url}/auth/create/admin`, data, {
      withCredentials: true,
    });
    return response;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const updateAdmin = async ({ adminID, ...updates }) => {
  try {
    const response = await axios.patch(
      `${base_url}/auth/update/admin?adminID=${adminID}`,
      updates,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteAdmin = async (adminID) => {
  try {
    const response = await axios.delete(
      `${base_url}/auth/remove/admin?adminID=${adminID}`,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

////////////////////////////////////////// members ///////////////////////////////////////////////////

export const getMembers = async ({ pageParam = 1, queryKey }) => {
  const [, id, search, status] = queryKey;
  const params = new URLSearchParams({
    page: String(pageParam),
    limit: "50",
    ...(search && { search }),
    ...(status && status !== "all" && { status }),
  });

  const response = await axios.get(`${base_url}/admin/get/members?${params}`, {
    withCredentials: true,
  });

  return response.data; 
};
export const createMember = async (data) => {
  try {
    const response = await axios.post(`${base_url}/admin/create/member`, data, {
      withCredentials: true,
    });
    return response;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const updateMember = async ({ Membership_No, ...updates }) => {
  try {
    const response = await axios.patch(
      `${base_url}/admin/update/member?memberID=${Membership_No}`,
      updates,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const deleteMember = async (memberID) => {
  try {
    const response = await axios.delete(
      `${base_url}/admin/remove/member?memberID=${memberID}`,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const createBulkMembers = async (data) => {
  try {
    const response = await axios.post(
      `${base_url}/admin/create/bulk/members`,
      data,
      { withCredentials: true }
    );
    console.log(response);
    return response;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const searchMembers = async (searchString) => {
  try {
    const response = await axios.get(
      `${base_url}/admin/search/members?searchFor=${searchString}`,
      { withCredentials: true }
    );
    return response;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

// Bookings
export const getBookings = async () => {
  try {
    const response = await axios.get(
      `${base_url}/admin/get/bookings/all`,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

export const createBooking = async (data) => {
  try {
    const response = await axios.post(
      `${base_url}/admin/create/booking`,
      data,
      { withCredentials: true }
    );
    return response;
  } catch (error) {
    console.log(error)
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};
export const updateBooking = async (data) => {
  try {
    const response = await axios.patch(
      `${base_url}/admin/update/booking`,
      data,
      { withCredentials: true }
    );
    return response;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const deleteBooking = async (bookID) => {
  try {
    const response = await axios.delete(
      `${base_url}/admin/delete/booking?bookID=${bookID}`,
      { withCredentials: true }
    );
    return response;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

// rooms
export const getRoomTypes = async () => {
  try {
    const response = await axios.get(`${base_url}/admin/get/roomTypes`, {
      withCredentials: true,
    });
    return response;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const createRoomType = async (data) => {
  try {
    const response = await axios.post(
      `${base_url}/admin/create/roomType`,
      data,
      { withCredentials: true }
    );
    return response;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const createRoom = async (data) => {
  try {
    const response = await axios.post(`${base_url}/admin/create/room`, data, {
      withCredentials: true,
    });
    return response;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const getAvailRooms = async (roomTypeId) => {
  try {
    const response = await axios.get(`${base_url}/admin/get/rooms/available?roomTypeId=${roomTypeId}`, {
      withCredentials: true,
    });
    return response;
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const updateRoom = async (data) => {
  try {
    const response = await axios.patch(`${base_url}/admin/update/room`, data, {
      withCredentials: true,
    });
    return response;
  } catch (error) {
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

export const createHall = async (data) => {
  try {
    const response = await axios.post(`${base_url}/admin/create/hall`, data, {
      withCredentials: true,
    });
    return response;
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const updateHall = async (data) => {
  try {
    const response = await axios.patch(`${base_url}/admin/update/hall`, data, {
      withCredentials: true,
    });
    return response;
  } catch (error) {
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

export const getLawnCategoriesNames = async (catId) => {
  try {
    const response = await axios.get(`${base_url}/admin/get/lawn/categories/names?catId=${catId}`, {
      withCredentials: true,
    });
    return response;
  } catch (error) {
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
    return response;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const createLawnCategory = async (data) => {
  try {
    const response = await axios.post(
      `${base_url}/admin/create/lawn/category`,
      data,
      {
        withCredentials: true,
      }
    );
    return response;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const updateLawnCategory = async (data) => {
  try {
    const response = await axios.patch(
      `${base_url}/admin/update/lawn/category`,
      data,
      {
        withCredentials: true,
      }
    );
    return response;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const deleteLawnCategory = async (catID) => {
  try {
    const response = await axios.delete(
      `${base_url}/admin/delete/lawn/category?catID=${catID}`,
      {
        withCredentials: true,
      }
    );
    return response;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

export const createLawn = async (data) => {
  try {
    const response = await axios.post(`${base_url}/admin/create/lawn`, data, {
      withCredentials: true,
    });
    return response;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const getAvailableLawns = async () => {
  try {
    const response = await axios.get(`${base_url}/admin/get/lawns`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
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
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const updateLawn = async (data) => {
  try {
    const response = await axios.patch(`${base_url}/admin/update/lawn`, data, {
      withCredentials: true,
    });
    return response;
  } catch (error) {
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
export const createPhotoshoot = async (data) => {
  try {
    const response = await axios.post(
      `${base_url}/admin/create/photoShoot`,
      data,
      {
        withCredentials: true,
      }
    );
    return response;
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const updatePhotoshoot = async (data) => {
  try {
    const response = await axios.patch(
      `${base_url}/admin/update/photoShoot`,
      data,
      {
        withCredentials: true,
      }
    );
    return response;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    console.log(error);
    throw { message, status: error.response?.status || 500 };
  }
};
export const deletePhotoshoot = async () => {};

// sports
export const createSport = async (data) => {
  try {
    const response = await axios.post(`${base_url}/admin/create/sport`, data, {
      withCredentials: true,
    });
    return response;
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

export const updateSport = async (data) => {
  try {
    const response = await axios.patch(`${base_url}/admin/update/sport`, data, {
      withCredentials: true,
    });
    return response;
  } catch (error) {
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
