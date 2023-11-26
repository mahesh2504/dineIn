const appConfig = {
  name: "Restaurant Dine-In Management System",
  logo: "https://img.freepik.com/premium-vector/restaurant-logo-design-template_79169-56.jpg?w=2000",
  taxPercent: 9.5,
  workingHours: {
    start: 10, //10am
    end: 22, //10pm
  },
  bookingTime: {
    min: "1h", //1 hour
    max: "2h", //2 hours
  },
  bookingBuffer: "15m", //15 minutes
  allotTableDirectly: false,
}

export default appConfig
