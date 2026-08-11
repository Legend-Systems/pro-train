/** Merges all translation chunks */
const q1 = require('./questions-1');
const q2 = require('./questions-2');
const q3 = require('./questions-3');
const q4 = require('./questions-4');
const options = require('./options-all');

module.exports = {
  courses: {
    "23": { title: "Vendas Técnicas", description: "Uma Solução Global para a Construção Moderna" },
    "28": { title: "ERP", description: "Este curso irá guiá-lo na instalação, configuração e utilização do ERP" },
    "34": { title: "Vendas Internas", description: "Domine os fundamentos das vendas internas e aprenda a prestar um serviço excecional ao cliente, impulsionando o crescimento do negócio." },
    "35": { title: "Vendas Externas 101", description: "Desenvolva as competências necessárias para identificar oportunidades, construir relações sólidas com clientes e impulsionar o crescimento do negócio no terreno." },
    "36": { title: "Cold Calling", description: "Domine os fundamentos do cold calling eficaz para gerar novas oportunidades de negócio e construir um pipeline de vendas sólido." },
  },
  tests: {
    "43": { title: "Sistemas de Drywall 🧩", description: "Sistemas de Drywall – 51mm, 63mm e 102mm" },
    "45": { title: "Sistema de Teto em Gesso Alisado", description: "Sistema de Teto em Gesso Alisado" },
    "51": { title: "Sistema de Teto Knock Up", description: "Habitação Económica e RDP – África do Sul" },
    "52": { title: "Mecanismos de Venda", description: "Estratégia de Vendas por Email | Comunicação Telefónica | Estratégia Facebook...." },
    "55": { title: "Sistemas de Teto Suspenso 🏆", description: "Também conhecidos como Tetos Falsos ou Tetos Descaídos" },
    "57": { title: "Instalação ERP", description: "Este teste abrange os passos e processos para instalar e configurar o ERP" },
    "59": { title: "SISTEMA DRYWALL STANDARD – MONTANTE 89 mm", description: "Cantoneiras de alumínio | Vãos de portas e janelas | 10 m de comprimento × 3 m de altura" },
    "60": { title: "SISTEMA DRYWALL COM CLASSIFICAÇÃO DE FOGO", description: "Classificação de 120 minutos | Parede de 162 mm | Isolada | 15 m de comprimento × 2,7 m de altura" },
    "61": { title: "PAREDE DRYWALL DE CASA DE BANHO", description: "Acabamento com azulejo | Carga de azulejo 20 kg/m²" },
    "62": { title: "PAREDE DE COZINHA", description: "Drywall com placas de cozinha na zona do tampo (armários / zona de splashback)" },
    "63": { title: "Gesso de Alisamento vs. Massa de Juntas", description: "Gesso de Alisamento vs. Massa de Juntas" },
    "64": { title: "Sistemas de Teto com Brandering", description: "Teto em Placa de Gesso com Brandering de Aço, Juntas Bishop Strip e Cantos Cove de 75 mm" },
    "65": { title: "Teto em Gesso Alisado | Placa de Gesso com Main Tees T37", description: "Teto em Placa de Gesso Alisado com Main Tees T37, Cross Tees T32 e Perímetro em Plaster Trim (Void Drop de 3 m)" },
    "66": { title: "Main Tees | Cross Tees 1200 mm", description: "Main Tees e Cross Tees de 1200 mm com Perímetro Shadow Line e Lajetas de Teto Lay-In em Placa de Gesso (Void Drop de 3 m)" },
    "83": { title: "Hora do Quiz!", description: "Teste Demo" },
  },
  questions: { ...q1, ...q2, ...q3, ...q4 },
  options,
};
