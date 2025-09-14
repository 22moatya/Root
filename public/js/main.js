document.querySelectorAll('.btnView').forEach(button => {
  button.addEventListener('click', () => {
    const serviceId = button.dataset.id;

    axios.get(`/api/services/${serviceId}`)
      .then(res => {
        const service = res.data;
        alert(`Service: ${service.name}\nPrice: $${service.price}`);
        // TODO: ممكن هنا بدل alert تفتح modal وتعرض تفاصيل الخدمة
      })
      .catch(err => console.error("Error fetching service:", err));
  });
});

