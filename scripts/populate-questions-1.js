/** Populates question translations into pt-pt-translations-map.js */
const fs = require('fs');
const path = require('path');

const mapPath = path.join(__dirname, 'pt-pt-translations-map.js');
delete require.cache[require.resolve(mapPath)];
const map = require(mapPath);

const nullFields = () => ({ explanation: null, hint: null });

const questions = {
  "114": { questionText: "Quais são os três tamanhos de montante mais comuns utilizados na África do Sul para sistemas de drywall?", ...nullFields() },
  "115": { questionText: "Qual tamanho de montante é mais adequado para paredes de alto desempenho, como as que requerem isolamento acústico ou resistência ao fogo?", ...nullFields() },
  "116": { questionText: "Que tipo de placa é recomendado para utilização em casas de banho, cozinhas e zonas húmidas?", ...nullFields() },
  "117": { questionText: "Qual é o tamanho típico de parafuso utilizado na instalação de uma única camada de drywall num montante metálico?", ...nullFields() },
  "118": { questionText: "Qual é a função principal de uma cantoneira (corner bead) em sistemas de drywall?", ...nullFields() },
  "119": { questionText: "Qual dos seguintes materiais de isolamento é comummente utilizado para isolamento acústico no interior das cavidades de drywall?", ...nullFields() },
  "120": { questionText: "Qual é o propósito de utilizar canais resilientes em sistemas de drywall?", ...nullFields() },
  "121": { questionText: "Qual é a vantagem de utilizar aço galvanizado em sistemas de drywall?", ...nullFields() },
  "122": { questionText: "Que tipo de construção de parede corta-fogo proporciona 60 minutos ou mais de resistência ao fogo?", ...nullFields() },
  "123": { questionText: "Que tipo de placa resistente ao fogo é mais comummente utilizado para divisórias com classificação de fogo?", ...nullFields() },
  "124": { questionText: "Em que tipo de áreas se utilizaria tipicamente placa de cimento devido à sua elevada resistência ao fogo?", ...nullFields() },
  "125": { questionText: "Que material é tipicamente utilizado para preencher as cavidades de drywall em paredes resistentes ao fogo?", ...nullFields() },
  "126": { questionText: "Que tipo de placa é comummente utilizado em áreas que requerem elevada resistência ao impacto, como salas de cinema ou hospitais?", ...nullFields() },
  "127": { questionText: "Qual das seguintes é uma vantagem chave das placas resistentes à humidade?", ...nullFields() },
  "128": { questionText: "Qual é o propósito do selante resistente ao fogo em sistemas de drywall?", ...nullFields() },
  "129": { questionText: "Qual é a aplicação típica de placa de gesso de alta densidade?", ...nullFields() },
  "130": { questionText: "Qual é o espaçamento standard dos montantes na maioria dos sistemas de drywall?", ...nullFields() },
  "131": { questionText: "Qual é o propósito principal da Fiba Tape nas instalações de drywall?", ...nullFields() },
  "132": { questionText: "Qual é o propósito de utilizar uma berbequim ou aparafusadora na instalação de drywall?", ...nullFields() },
  "133": { questionText: "O que deve fazer para garantir que a instalação de drywall seja estruturalmente sólida?", ...nullFields() },
  "134": { questionText: "Que tipo de rodapé é mais comummente utilizado em espaços comerciais devido à baixa manutenção e aspeto moderno?", ...nullFields() },
  "135": { questionText: "Qual é o principal benefício de utilizar rodapé de vinil ou borracha nos setores da saúde e educação?", ...nullFields() },
  "136": { questionText: "Qual das seguintes faz parte da inspeção final após a instalação de drywall?", ...nullFields() },
  "137": { questionText: "Porque é importante escalonar as juntas entre placas durante a instalação?", ...nullFields() },
  "146": { questionText: "Qual é a espessura standard de placa utilizada em tetos em gesso alisado?", ...nullFields() },
  "147": { questionText: "Qual é o propósito do main tee num sistema de teto?", ...nullFields() },
  "148": { questionText: "As cross tees são normalmente espaçadas a:", ...nullFields() },
  "149": { questionText: "O cantoneira de parede (wall angle trim) tem normalmente a dimensão:", ...nullFields() },
  "150": { questionText: "De que material são tipicamente feitos os brandering?", ...nullFields() },
  "151": { questionText: "Para que é utilizado principalmente o shadow line trim?", ...nullFields() },
  "152": { questionText: "Que tipo de isolamento é comummente utilizado acima de tetos em gesso alisado?", ...nullFields() },
  "153": { questionText: "BitLite é um exemplo de:", ...nullFields() },
  "154": { questionText: "A fita Fiba é utilizada para:", ...nullFields() },
  "155": { questionText: "Que comprimento de parafuso é tipicamente utilizado para placa de 9,5 mm?", ...nullFields() },
  "156": { questionText: "Os T junctions são necessários apenas para tetos suspensos.", ...nullFields() },
  "157": { questionText: "As cornijas são sempre necessárias em tetos em gesso alisado.", ...nullFields() },
  "158": { questionText: "O gesso de alisamento cria um acabamento liso e pintável.", ...nullFields() },
  "159": { questionText: "As placas de teto devem ser encostadas firmemente às paredes.", ...nullFields() },
  "160": { questionText: "Os rawl bolts são utilizados para fixar tetos a lajes de betão.", ...nullFields() },
  "161": { questionText: "Indique uma razão para utilizar isolamento acima de um teto.", ...nullFields() },
  "162": { questionText: "Mencione um benefício de utilizar gesso de alisamento em vez de pintar as placas diretamente.", ...nullFields() },
  "163": { questionText: "Qual é o espaçamento típico do brandering de aço galvanizado em tetos em gesso alisado?", ...nullFields() },
  "164": { questionText: "Que dimensão de placa é comummente utilizada na África do Sul para tetos em gesso alisado? (indique as dimensões)", ...nullFields() },
  "165": { questionText: "Indique duas ferramentas necessárias para instalar um teto em gesso alisado.", ...nullFields() },
  "199": { questionText: "Quais são os principais benefícios do Sistema de Teto Knock Up em habitação RDP? (Selecione todas as aplicáveis)", ...nullFields() },
  "200": { questionText: "Porque é que este sistema de teto é preferido em projetos de habitação económica na África do Sul?", ...nullFields() },
  "201": { questionText: "Quais são as especificações de espessura comuns das placas de teto utilizadas neste sistema?", ...nullFields() },
  "202": { questionText: "Indique as duas larguras disponíveis e os três comprimentos standard das placas de teto comummente utilizadas no sistema.", ...nullFields() },
  "203": { questionText: "Quais são as medidas de espaçamento típicas entre os elementos de brandering?", ...nullFields() },
  "204": { questionText: "Associe o tipo de brandering à sua utilização típica:\nA) Brandering de madeira\nB) Brandering de aço\n\nOpções:\n1.\tConstruções rurais e económicas\n2.\tDesenvolvimentos urbanos e multi-unidade\n", ...nullFields() },
  "205": { questionText: "Indique duas vantagens de utilizar brandering de aço em relação ao brandering de madeira.", ...nullFields() },
  "206": { questionText: "Qual é a função da fita H (também chamada junta H ou fita M)?", ...nullFields() },
  "207": { questionText: "Identifique os fixadores corretos para cada tipo de brandering:\n•\tBrandering de Madeira →\n•\tBrandering de Aço →", ...nullFields() },
  "208": { questionText: "Quando se utiliza massa de juntas e fita em vez de fitas H?", ...nullFields() },
  "209": { questionText: "Que tipos de isolamento podem ser instalados acima das placas de teto? (Indique dois)", ...nullFields() },
  "210": { questionText: "Associe o tipo de isolamento à sua característica:\n•\ta) Lã de Vidro\n•\tb) Isotherm\n•\tc) Lã Mineral\n\nOpções:\n1.\tNão tóxico, ecológico\n2.\tMelhor para isolamento acústico\n3.\tResistente ao fogo, propriedades térmicas e acústicas", ...nullFields() },
  "211": { questionText: "Indique os passos finais para concluir o teto após a instalação das placas.", ...nullFields() },
  "212": { questionText: "Mencione três razões pelas quais este sistema melhora a eficiência energética em habitações RDP.", ...nullFields() },
  "213": { questionText: "O sistema de teto knock up é compatível apenas com brandering de madeira.", ...nullFields() },
  "214": { questionText: "Qual é um elemento chave a incluir no assunto de um email de vendas?", ...nullFields() },
  "215": { questionText: "Porque é a personalização importante num email de vendas?", ...nullFields() },
  "216": { questionText: "Qual é uma linha de abertura recomendada ao telefonar a um potencial cliente?", ...nullFields() },
  "217": { questionText: "O que deve ser confirmado antes de terminar a chamada telefónica?", ...nullFields() },
  "218": { questionText: "Que tipo de conteúdo visual funciona melhor em publicações no Facebook?", ...nullFields() },
  "219": { questionText: "Qual é uma forma eficaz de interagir com potenciais clientes em páginas relacionadas no Facebook?", ...nullFields() },
  "220": { questionText: "Qual é uma forma de utilizar Instagram Stories para promover drywall?", ...nullFields() },
  "221": { questionText: "Porque são importantes as hashtags nas publicações do Instagram?", ...nullFields() },
  "222": { questionText: "O que deve ser enviado após um potencial cliente responder positivamente no WhatsApp?", ...nullFields() },
  "223": { questionText: "Que funcionalidade no WhatsApp ajuda a tratar FAQs de forma eficiente?", ...nullFields() },
  "224": { questionText: "Qual é uma boa razão para enviar um pedido de ligação no LinkedIn?", ...nullFields() },
  "225": { questionText: "Que tipo de conteúdo pode ser publicado para atrair interesse no LinkedIn?", ...nullFields() },
  "226": { questionText: "Qual é uma forma simples de atrair pessoas para uma promoção na loja?", ...nullFields() },
  "227": { questionText: "O que devem incluir os folhetos distribuídos em eventos?", ...nullFields() },
  "228": { questionText: "Porque é a consistência importante em todos os canais de comunicação?", ...nullFields() },
  "229": { questionText: "Quando é o momento ideal para fazer follow-up após o contacto inicial?", ...nullFields() },
  "256": { questionText: "O que é um teto suspenso?", ...nullFields() },
  "257": { questionText: "Qual dos seguintes materiais é comummente utilizado para lajetas de teto suspenso na África do Sul?", ...nullFields() },
  "258": { questionText: "Qual é o propósito do trim perimetral (M6 ou Shadowline)?", ...nullFields() },
  "259": { questionText: "Qual é o tamanho mais comum de uma lajeta de teto num sistema de teto suspenso?", ...nullFields() },
  "260": { questionText: "Que tipo de lajeta de teto é conhecido por proporcionar elevada absorção acústica?", ...nullFields() },
  "261": { questionText: "Qual é a função principal dos fios de suspensão num sistema de teto suspenso?", ...nullFields() },
  "262": { questionText: "Qual dos seguintes é tipicamente utilizado em hospitais e clínicas para tetos suspensos?", ...nullFields() },
  "263": { questionText: "Qual é a altura de descida (drop) típica de um teto suspenso?", ...nullFields() },
  "264": { questionText: "Que componente bloqueia os main tees e cross tees entre si para garantir o alinhamento da grelha?", ...nullFields() },
  "265": { questionText: "Qual é uma das principais razões para instalar tetos suspensos em escritórios comerciais?", ...nullFields() },
};

Object.assign(map.questions, questions);

const out = `/** Auto-generated translation map – European Portuguese (pt-PT) */
module.exports = ${JSON.stringify(map, null, 2)
  .replace(/"questionText":/g, 'questionText:')
  .replace(/"explanation":/g, 'explanation:')
  .replace(/"hint":/g, 'hint:')
  .replace(/"title":/g, 'title:')
  .replace(/"description":/g, 'description:')
  .replace(/"optionText":/g, 'optionText:')
  .replace(/"(\d+)":/g, '"$1":')};
`;

fs.writeFileSync(mapPath, out.replace(/"(\d+)":/g, '"$1":'), 'utf8');
console.log('Questions batch 1:', Object.keys(map.questions).length);
