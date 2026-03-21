# EXERCÍCIO 1 - Média e aprovação

print("=" * 40)
print("EXERCÍCIO 1 - Aprovação")
print("=" * 40)
nota1 = float(input("Digite a nota 1: "))
nota2 = float(input("Digite a nota 2: "))
nota3 = float(input("Digite a nota 3: "))
nota4 = float(input("Digite a nota 4: "))
media = (nota1 + nota2 + nota3 + nota4) / 4
print(f"Média: {media:.2f}")
if media >= 7:
    print("Aluno APROVADO!")
else:
    print("Aluno REPROVADO!")
