from django.db import models

class Piece(models.Model):
    reference = models.CharField(max_length=50, unique=True)
    nom = models.CharField(max_length=100)
    categorie = models.CharField(max_length=50)
    prix_achat = models.DecimalField(max_digits=10, decimal_places=2)
    prix_vente = models.DecimalField(max_digits=10, decimal_places=2)
    date_ajout = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.reference} - {self.nom}"

class Offer(models.Model):
    piece = models.ForeignKey(Piece, on_delete=models.CASCADE)
    supplier_name = models.CharField(max_length=100)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, default='pending')

class Order(models.Model):
    offer = models.ForeignKey(Offer, on_delete=models.CASCADE)
    quantity = models.IntegerField(default=1)
    status = models.CharField(max_length=20, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

class SupplierReview(models.Model):
    supplier_name = models.CharField(max_length=100)
    rating = models.IntegerField()
    comment = models.TextField(blank=True)