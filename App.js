import React, { useState, useEffect, useRef } from "react";
import {
  SafeAreaView,
  View,
  Text,
  ImageBackground,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Platform,
  Dimensions,
  Alert,
} from "react-native";
import { Audio } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

export default function App() {
  // telas: 'inicio','login','cadastro','niveis','frases','parabensNivel','parabensFinal','sobre'
  const [tela, setTela] = useState("inicio");

  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [sexo, setSexo] = useState(""); // 'masculino', 'feminino', 'naoDeclarar'
  const [mostrarSelecaoSexo, setMostrarSelecaoSexo] = useState(false);

  const [somAtivo, setSomAtivo] = useState(true);
  const soundRef = useRef(null);

  const [nivelSelecionado, setNivelSelecionado] = useState(null);
  const [frases, setFrases] = useState([]);
  const [index, setIndex] = useState(0);

  const [progressoPorNivel, setProgressoPorNivel] = useState({
    iniciante: 0,
    basico: 0,
    intermedio: 0,
    avancado: 0,
    profissional: 0,
  });
  const [progressoTotal, setProgressoTotal] = useState(0);

  // -----------------------------
  // Carregar e tocar música (global)
  // -----------------------------
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require("./musica.mp3"),
          { shouldPlay: true, isLooping: true, volume: 0.35 }
        );
        if (!mounted) {
          await sound.unloadAsync().catch(() => {});
          return;
        }
        soundRef.current = sound;
        try {
          await sound.playAsync();
          setSomAtivo(true);
        } catch {
          // autoplay bloqueado em alguns dispositivos
          setSomAtivo(false);
        }
      } catch (e) {
        console.warn("Erro ao carregar som:", e);
        setSomAtivo(false);
      }
    })();
    return () => {
      mounted = false;
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  async function alternarSom() {
    const s = soundRef.current;
    if (!s) {
      setSomAtivo(false);
      return;
    }
    try {
      const status = await s.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        await s.pauseAsync();
        setSomAtivo(false);
      } else {
        await s.playAsync();
        setSomAtivo(true);
      }
    } catch (e) {
      console.warn("Erro alternar som:", e);
    }
  }

  // -----------------------------
  // AsyncStorage helpers
  // -----------------------------
  async function salvarDadosUsuario(nomeUsuario, dados) {
    if (!nomeUsuario) return;
    try {
      await AsyncStorage.setItem(`@devEnglish_${nomeUsuario}`, JSON.stringify(dados));
    } catch (e) {
      console.warn("Erro salvarDadosUsuario:", e);
    }
  }

  async function carregarDadosUsuario(nomeUsuario) {
    if (!nomeUsuario) return null;
    try {
      const s = await AsyncStorage.getItem(`@devEnglish_${nomeUsuario}`);
      return s ? JSON.parse(s) : null;
    } catch (e) {
      console.warn("Erro carregarDadosUsuario:", e);
      return null;
    }
  }

  async function salvarAndamento(nomeUsuario, nivelId, idx) {
    if (!nomeUsuario) return;
    try {
      const dados = (await carregarDadosUsuario(nomeUsuario)) || {};
      dados.andamento = dados.andamento || {};
      dados.andamento[nivelId] = idx;
      await salvarDadosUsuario(nomeUsuario, dados);
    } catch (e) {
      console.warn("Erro salvarAndamento:", e);
    }
  }

  async function carregarAndamento(nomeUsuario, nivelId) {
    try {
      const dados = (await carregarDadosUsuario(nomeUsuario)) || {};
      return (dados.andamento && typeof dados.andamento[nivelId] === "number")
        ? dados.andamento[nivelId]
        : 0;
    } catch {
      return 0;
    }
  }

  async function salvarProgressoUsuario(nomeUsuario, novosProgresso) {
    if (!nomeUsuario) return;
    try {
      const dados = (await carregarDadosUsuario(nomeUsuario)) || {};
      dados.progressoPorNivel = novosProgresso;
      const soma =
        (novosProgresso.iniciante || 0) +
        (novosProgresso.basico || 0) +
        (novosProgresso.intermedio || 0) +
        (novosProgresso.avancado || 0) +
        (novosProgresso.profissional || 0);
      const total = Math.round((soma / 500) * 1000) / 10; // Calcula com 1 casa decimal
      dados.progressoTotal = total;
      await salvarDadosUsuario(nomeUsuario, dados);
    } catch (e) {
      console.warn("Erro salvarProgressoUsuario:", e);
    }
  }

  function atualizarProgressoTotal(novos) {
    const soma =
      (novos.iniciante || 0) +
      (novos.basico || 0) +
      (novos.intermedio || 0) +
      (novos.avancado || 0) +
      (novos.profissional || 0);
    // Calcula o total com 1 casa decimal
    const total = Math.round((soma / 500) * 1000) / 10; 
    setProgressoTotal(total);
    return total;
  }

  // -----------------------------
  // CARREGAR NÍVEL
  // -----------------------------
  async function carregarNivel(nivel) {
    setNivelSelecionado(nivel);
    setIndex(0);
    try {
      let arquivo = [];
      if (nivel === "iniciante") arquivo = require("./frases_iniciante.json");
      else if (nivel === "basico") arquivo = require("./frases_basico.json");
      else if (nivel === "intermedio") arquivo = require("./frases_intermediario.json");
      else if (nivel === "avancado") arquivo = require("./frases_avancado.json");
      else if (nivel === "profissional") arquivo = require("./frases_pro.json");
      setFrases(arquivo || []);
      // carrega andamento salvo
      if (usuario) {
        const idx = await carregarAndamento(usuario, nivel);
        setIndex(idx || 0);
      } else {
        setIndex(0);
      }
      setTela("frases");
    } catch (e) {
      Alert.alert("Erro", "Não foi possível carregar as frases: " + e);
    }
  }

  // -----------------------------
  // NAVEGAR FRASES
  // -----------------------------
  async function proximaFrase() {
    if (!frases || frases.length === 0) return;
    if (index < frases.length - 1) {
      const novoIndex = index + 1;
      setIndex(novoIndex);

      // Calcula a porcentagem com uma casa decimal
      const pctBruto = ((novoIndex + 1) / frases.length) * 100;
      const pct = Math.round(pctBruto * 10) / 10; // Arredonda para 1 casa decimal
      
      const novos = { ...progressoPorNivel, [nivelSelecionado]: pct };
      setProgressoPorNivel(novos);
      const total = atualizarProgressoTotal(novos);

      if (usuario) {
        await salvarAndamento(usuario, nivelSelecionado, novoIndex);
        await salvarProgressoUsuario(usuario, novos);
      }
    } else {
      // terminou o nível
      const novos = { ...progressoPorNivel, [nivelSelecionado]: 100 };
      setProgressoPorNivel(novos);
      const total = atualizarProgressoTotal(novos);
      if (usuario) {
        await salvarAndamento(usuario, nivelSelecionado, frases.length - 1);
        await salvarProgressoUsuario(usuario, novos);
      }
      if (total >= 100) setTela("parabensFinal");
      else setTela("parabensNivel");
    }
  }

  function anteriorFrase() {
    if (index > 0) setIndex(index - 1);
  }
  
  // -----------------------------
  // RENDER HEADER
  // -----------------------------
  function HeaderGlobal() {
    if (["inicio", "login", "cadastro", "sobre"].includes(tela)) return null;
    
    let emoji = "";
    if (sexo === "feminino") emoji = "👩‍💻";
    else if (sexo === "masculino") emoji = "👨‍💻";

    // Formata o progresso total para 1 casa decimal
    const totalFormatado = progressoTotal % 1 === 0 ? progressoTotal.toFixed(0) : progressoTotal.toFixed(1);

    return (
      <View style={styles.header}>
        <View style={styles.headerRow}>
          {emoji ? <Text style={styles.headerEmoji}>{emoji}</Text> : null}
          <Text style={styles.headerUser}>{usuario || "Convidado"}</Text>
          <Text style={styles.headerPercent}>{totalFormatado}%</Text>
        </View>
        <View style={styles.headerProgress}>
          <View style={[styles.headerProgressFill, { width: `${progressoTotal}%` }]} />
        </View>
      </View>
    );
  }

  // -----------------------------
  // BOTÃO GLOBAL DE VOLTAR ◀️
  // -----------------------------
  function BotaoVoltarGlobal() {
    if (tela === "inicio") return null;

    let targetTela = "inicio";
    if (["login", "cadastro"].includes(tela)) targetTela = "inicio";
    else if (tela === "sobre") targetTela = "inicio";
    else if (tela === "niveis") targetTela = "login";
    else if (tela === "frases") targetTela = "niveis";
    else if (["parabensNivel", "parabensFinal"].includes(tela)) targetTela = "niveis";

    // Lógica para voltar do login/cadastro caso os dados tenham sido preenchidos
    const goBack = () => {
        if (tela === "login") {
            setUsuario("");
            setSenha("");
        }
        setTela(targetTela);
    };

    return (
      <TouchableOpacity 
        style={styles.voltarIconGlobal} 
        onPress={goBack}
      >
        <Text style={styles.iconeVoltar}>◀️</Text>
      </TouchableOpacity>
    );
  }

  // -----------------------------
  // BOTÃO GLOBAL DE SOM 🔊
  // -----------------------------
  function BotaoSomGlobal() {
    return (
      <TouchableOpacity 
        style={styles.somTopGlobal} 
        onPress={alternarSom}
      >
        <Ionicons
          name={somAtivo ? "volume-high" : "volume-mute"}
          size={30}
          color="white"
        />
      </TouchableOpacity>
    );
  }


// ============================
//  TELA INICIAL (FUNDO)
// ============================
if (tela === "inicio") {
  return (
    <ImageBackground
      source={require("./fundodev.png")}
      style={styles.fundoInicio}
      resizeMode="contain" 
    >
      {/* Área que contém os botões, agora empurrada para o final */}
      <View
        style={styles.centerAreaInicioAjustada}
      >
        <TouchableOpacity
          style={styles.botaoInicio}
          onPress={() => setTela("login")}
        >
          <Text style={styles.textoBotaoInicio}>
            Começar
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.botaoInicio}
          onPress={() => setTela("login")}
        >
          <Text style={styles.textoBotaoInicio}>
            Continuar
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.botaoInicio}
          onPress={() => setTela("sobre")}
        >
          <Text style={styles.textoBotaoInicio}>
            Sobre
          </Text>
        </TouchableOpacity>
      </View>
      <BotaoSomGlobal />
    </ImageBackground>
  );
}

  // TELA LOGIN
  if (tela === "login") {
    return (
      <SafeAreaView style={styles.containerCentralizado}>
        <Text style={styles.title}>Entrar / Criar Conta</Text>

        <TextInput
          style={styles.input}
          placeholder="Usuário"
          placeholderTextColor="#aaa"
          value={usuario}
          onChangeText={setUsuario}
        />

        <TextInput
          style={styles.input}
          placeholder="Senha (mínimo 8)"
          placeholderTextColor="#aaa"
          secureTextEntry
          value={senha}
          onChangeText={setSenha}
        />

        <TouchableOpacity
          style={styles.botaoPrincipal}
          onPress={async () => {
            if (!usuario || senha.length < 8) {
              Alert.alert("Atenção", "Preencha usuário e senha (mínimo 8).");
              return;
            }
            const dados = await carregarDadosUsuario(usuario);
            if (dados) {
              setProgressoPorNivel(dados.progressoPorNivel || progressoPorNivel);
              setProgressoTotal(dados.progressoTotal || 0);
              setSexo(dados.sexo || "");
              setTela("niveis");
            } else {
              // cria entrada mínima e vai para cadastro
              await salvarDadosUsuario(usuario, {
                progressoPorNivel,
                progressoTotal,
                andamento: {},
                sexo: sexo || "", 
              });
              setTela("cadastro");
            }
          }}
        >
          <Text style={styles.botaoTexto}>Entrar</Text>
        </TouchableOpacity>

        {/* CORREÇÃO: Usando um Fragmento (<>) para agrupar os elementos JSX adjacentes */}
        <>
          <BotaoVoltarGlobal />
          <BotaoSomGlobal />
        </>
      </SafeAreaView>
    );
  }

  // TELA CADASTRO
  if (tela === "cadastro") {
    return (
      <SafeAreaView style={styles.containerCentralizado}>
        <Text style={styles.title}>Criar Conta</Text>

        <TextInput style={styles.input} placeholder="Usuário" placeholderTextColor="#aaa" value={usuario} onChangeText={setUsuario} />
        <TextInput style={styles.input} placeholder="Senha (mínimo 8)" placeholderTextColor="#aaa" secureTextEntry value={senha} onChangeText={setSenha} />

        {/* Campo de seleção de sexo */}
        <TouchableOpacity style={styles.input} onPress={() => setMostrarSelecaoSexo(!mostrarSelecaoSexo)}>
          <Text style={{ color: sexo ? "white" : "#aaa", fontSize: 18 }}>
            {sexo === "masculino" ? "Masculino" : sexo === "feminino" ? "Feminino" : sexo === "naoDeclarar" ? "Não Declarar" : "Selecione o sexo"}
          </Text>
        </TouchableOpacity>
        
        {/* Opções de sexo */}
        {mostrarSelecaoSexo && (
          <View style={styles.boxSexo}>
            <TouchableOpacity onPress={() => { setSexo("masculino"); setMostrarSelecaoSexo(false); }}>
              <Text style={styles.opcaoSexo}>Masculino</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setSexo("feminino"); setMostrarSelecaoSexo(false); }}>
              <Text style={styles.opcaoSexo}>Feminino</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setSexo("naoDeclarar"); setMostrarSelecaoSexo(false); }}>
              <Text style={styles.opcaoSexo}>Não Declarar</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={styles.botaoPrincipal}
          onPress={async () => {
            if (!usuario || senha.length < 8 || !sexo) {
              Alert.alert("Atenção", "Preencha usuário, senha (mínimo 8) e selecione o sexo.");
              return;
            }
            const dados = {
              progressoPorNivel,
              progressoTotal,
              andamento: {},
              sexo,
            };
            await salvarDadosUsuario(usuario, dados);
            setTela("niveis");
          }}
        >
          <Text style={styles.botaoTexto}>Criar Conta</Text>
        </TouchableOpacity>

        {/* CORREÇÃO: Usando um Fragmento (<>) para agrupar os elementos JSX adjacentes */}
        <>
          <BotaoVoltarGlobal />
          <BotaoSomGlobal />
        </>
      </SafeAreaView>
    );
  }

  // TELA SOBRE
  if (tela === "sobre") {
    return (
      <SafeAreaView style={styles.containerSobre}>
        <Text style={styles.title}>Sobre o App</Text>
        
        {/* Adicionei flex: 1 na ScrollView para que ela ocupe todo o espaço e permita a centralização vertical do conteúdo */}
        <ScrollView contentContainerStyle={styles.scrollSobre}>
          <Text style={styles.textoSobre}>
            DevEnglish Daily — frases de inglês técnico para desenvolvedores.
            {"\n\n"}
            O app traz frases úteis para programação, deploy, revisão de código e
            comunicação técnica em inglês.
            {"\n\n"}
            Desenvolvido por Materson Barros.
          </Text>
        </ScrollView>

        {/* CORREÇÃO: Usando um Fragmento (<>) para agrupar os elementos JSX adjacentes */}
        <>
          <BotaoVoltarGlobal />
          <BotaoSomGlobal />
        </>
      </SafeAreaView>
    );
  }

  // TELA NÍVEIS
  if (tela === "niveis") {
    return (
      <SafeAreaView style={styles.container}>
        <HeaderGlobal />
        
        {/* Area Niveis Centralizada garante a centralização vertical */}
        <View style={styles.areaNiveisCentralizada}>
            
            {/* ScrollView AGORA com flex: 1 para centralizar o conteúdo verticalmente */}
            <ScrollView contentContainerStyle={styles.listaNiveis} style={{ flex: 1 }}>
              <Text style={styles.titleNiveis}>Selecione o nível</Text> 
              {[
                { id: "iniciante", nome: "Iniciante" },
                { id: "basico", nome: "Básico" },
                { id: "intermedio", nome: "Intermediário" },
                { id: "avancado", nome: "Avançado" },
                { id: "profissional", nome: "Profissional" },
              ].map((n) => {
                const nivelProgresso = progressoPorNivel[n.id] || 0;
                const progressoFormatado = nivelProgresso % 1 === 0 ? nivelProgresso.toFixed(0) : nivelProgresso.toFixed(1);

                return (
                  <TouchableOpacity
                    key={n.id}
                    style={styles.cardNivel}
                    onPress={async () => {
                      await carregarNivel(n.id);
                    }}
                  >
                    <Text style={styles.nomeNivel}>{n.nome}</Text>
                    <Text style={styles.porcentNivel}>{progressoFormatado}%</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
        </View>

        {/* CORREÇÃO: Usando um Fragmento (<>) para agrupar os elementos JSX adjacentes */}
        <>
          <BotaoVoltarGlobal />
          <BotaoSomGlobal />
        </>
      </SafeAreaView>
    );
  }

  // TELA FRASES
  if (tela === "frases") {
    const total = frases.length || 0;
    return (
      <SafeAreaView style={styles.container}>
        <HeaderGlobal />

        <Text style={styles.contadorTopo}>{index + 1} de {total}</Text>

        {/* Navegação acima do botão de voltar */}
        <View style={styles.navegacao}>
          <TouchableOpacity 
            style={[styles.botaoNav, index === 0 && styles.botaoNavInativo]} 
            onPress={anteriorFrase}
            disabled={index === 0}
          >
            <Text style={styles.textoNav}>Anterior</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.botaoNav} onPress={proximaFrase}>
            <Text style={styles.textoNav}>Próxima</Text>
          </TouchableOpacity>
        </View>

        {/* FraseBox CENTRALIZADO verticalmente e horizontalmente */}
        <View style={styles.fraseBox}>
          <ScrollView contentContainerStyle={styles.scrollFrase}>
            <Text style={styles.fraseIngles}>{frases[index]?.en}</Text>
            <Text style={styles.frasePort}>{frases[index]?.pt}</Text>
          </ScrollView>
        </View>

        {/* CORREÇÃO: Usando um Fragmento (<>) para agrupar os elementos JSX adjacentes */}
        <>
          <BotaoVoltarGlobal />
          <BotaoSomGlobal />
        </>
      </SafeAreaView>
    );
  }

  // TELA PARABENS NÍVEL
  if (tela === "parabensNivel") {
    return (
      <SafeAreaView style={styles.container}>
        <HeaderGlobal />
        
        {/* Conteúdo CENTRALIZADO na área restante da tela */}
        <View style={styles.areaParabensCentralizada}>
            <View style={styles.cardParabens}>
              <Text style={styles.tituloParabens}>🎉 Parabéns, {usuario}!</Text>
              <Text style={styles.textoParabens}>Você concluiu todas as frases deste nível.</Text>
            </View>
        </View>
        
        {/* CORREÇÃO: Usando um Fragmento (<>) para agrupar os elementos JSX adjacentes */}
        <>
          <BotaoVoltarGlobal />
          <BotaoSomGlobal />
        </>
      </SafeAreaView>
    );
  }

  // TELA PARABÉNS FINAL
  if (tela === "parabensFinal") {
    return (
      <SafeAreaView style={styles.container}>
        <HeaderGlobal />

        {/* Conteúdo CENTRALIZADO na área restante da tela */}
        <View style={styles.areaParabensCentralizada}>
            <View style={styles.cardParabensFinal}>
              <Text style={styles.tituloParabensFinal}>🎓 Conclusão Total!</Text>
              <Text style={styles.textoParabensFinal}>Parabéns, {usuario}! Você concluiu todos os níveis do DevEnglish Daily.</Text>
            </View>
        </View>

        {/* CORREÇÃO: Usando um Fragmento (<>) para agrupar os elementos JSX adjacentes */}
        <>
          <BotaoVoltarGlobal />
          <BotaoSomGlobal />
        </>
      </SafeAreaView>
    );
  }

  return null;
}

// ========================== STYLES ==========================
const styles = StyleSheet.create({
  // Container Padrão (usa flex-start)
  container: {
    flex: 1,
    backgroundColor: "#071025",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  // Container Centralizado (usa center) - para Login, Cadastro
  containerCentralizado: {
    flex: 1,
    backgroundColor: "#071025",
    alignItems: "center",
    justifyContent: "center", 
  },
  // Container para a tela Sobre
  containerSobre: {
    flex: 1,
    backgroundColor: "#071025",
    alignItems: "center",
    justifyContent: "flex-start", 
    paddingTop: Platform.OS === "android" ? 30 : 60, 
  },

  // NOVO ESTILO: Botão de Som Global (substitui os outros 'somTop')
  somTopGlobal: {
    position: "absolute",
    // Ajustado para não colidir com o Header/SafeAreaView no topo
    top: Platform.OS === "android" ? 35 : 55, 
    left: 20,
    zIndex: 50,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 10,
    borderRadius: 50,
  },

  // fundo inicial
  fundoInicio: {
    flex: 1,
    width: "100%",
    height: "100%",
    justifyContent: "flex-end", 
    alignItems: "center",
    paddingBottom: Platform.OS === "android" ? 20 : 40,
    backgroundColor: "#071025", 
  },

  // Área central na tela de Início (contém os botões)
  centerAreaInicioAjustada: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  // Estilo dos botões da tela de Início
  botaoInicio: {
    width: "75%",
    paddingVertical: 15,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 20, 
  },
  
  // Estilo do texto dos botões de Início
  textoBotaoInicio: { 
    color: "white", 
    fontSize: 22, 
    fontWeight: "bold" 
  },


  botaoPrincipal: {
    width: "72%",
    paddingVertical: 14,
    backgroundColor: "#7fc3ff", 
    marginTop: 18,
    borderRadius: 12,
    alignItems: "center",
  },

  botaoTexto: {
    color: "#071025", 
    fontSize: 18,
    fontWeight: "bold",
  },

  // títulos e inputs
  title: {
    fontSize: 26,
    color: "white",
    fontWeight: "bold",
    marginBottom: 20, 
  },

  // Título específico para tela Níveis
  titleNiveis: {
    fontSize: 26,
    color: "white",
    fontWeight: "bold",
    marginTop: 20, // Espaçamento TOP para separar do Header
    marginBottom: 20, // Espaçamento BOTTOM para separar dos cards
    textAlign: 'center',
  },

  input: {
    width: "86%",
    backgroundColor: "#0f1420",
    padding: 14,
    borderRadius: 10,
    marginTop: 12,
    fontSize: 16,
    color: "white",
    justifyContent: 'center', 
  },

  // Estilos para seleção de sexo
  boxSexo: {
    width: "86%",
    backgroundColor: "#153158",
    padding: 10,
    borderRadius: 10,
    marginTop: 5,
  },
  opcaoSexo: {
    color: "white",
    fontSize: 16,
    paddingVertical: 8,
    paddingHorizontal: 5,
  },


  // sobre
  scrollSobre: {
    flexGrow: 1, 
    width: "90%",
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingBottom: 80,
  },
  textoSobre: {
    color: "white",
    fontSize: 18,
    lineHeight: 24,
    textAlign: "center", 
  },

  // header 
  header: {
    width: "100%",
    paddingTop: Platform.OS === "android" ? 40 : 70, 
    paddingBottom: 12,
    backgroundColor: "#1b3b6f",
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  headerEmoji: {
    fontSize: 32,
  },

  headerUser: {
    fontSize: 20,
    color: "white",
    fontWeight: "bold",
  },

  headerPercent: {
    fontSize: 18,
    color: "#dff4ff",
    marginLeft: 8,
  },

  headerProgress: {
    marginTop: 10,
    width: "80%",
    height: 10,
    backgroundColor: "#213248",
    borderRadius: 8,
    overflow: "hidden",
  },

  headerProgressFill: {
    height: "100%",
    backgroundColor: "#7fc3ff",
  },
  
  // Área que engloba o título e lista de níveis (para centralizar o conjunto)
  areaNiveisCentralizada: {
    flex: 1, 
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center', 
  },

  // níveis
  listaNiveis: {
    width: "92%",
    alignItems: "center", 
    // Garante que o conteúdo fique centralizado dentro do ScrollView flexível
    justifyContent: 'center',
    flexGrow: 1, 
  },

  cardNivel: {
    backgroundColor: "#153158",
    width: "90%", 
    paddingVertical: 18, 
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 18, 
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  nomeNivel: {
    fontSize: 22,
    color: "white",
    fontWeight: "bold",
  },

  porcentNivel: {
    fontSize: 20,
    color: "#cfe9ff",
    fontWeight: "bold",
  },

  // Botão Voltar Global (◀️) - Único botão de voltar
  voltarIconGlobal: {
    position: "absolute",
    bottom: Platform.OS === "android" ? 20 : 40,
    left: 20,
    zIndex: 10,
    backgroundColor: "rgba(27,59,111, 0.7)",
    borderRadius: 50,
    padding: 10,
  },

  iconeVoltar: {
    fontSize: 24,
    color: "white",
  },

  // frases
  contadorTopo: {
    fontSize: 18,
    color: "#bfe0ff",
    marginTop: 12,
  },

  // Navegação
  navegacao: {
    width: "100%",
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "space-evenly",
    marginBottom: 8, 
  },

  botaoNav: {
    backgroundColor: "#1b3b6f",
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 10,
  },
  botaoNavInativo: {
    backgroundColor: "#0d1b32", 
  },

  textoNav: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  
  // FraseBox: Ocupa o espaço central
  fraseBox: {
    width: "92%",
    flex: 1,
    marginTop: 10,
    // Margin Bottom maior para liberar espaço acima do botão Voltar (80px)
    marginBottom: 80, 
    backgroundColor: "#153158", 
    borderRadius: 14,
    padding: 18,
    justifyContent: "center", 
  },

  scrollFrase: {
    flexGrow: 1,
    justifyContent: "center", 
    alignItems: "center", 
    paddingBottom: 20,
  },

  fraseIngles: {
    fontSize: 24, 
    fontWeight: "bold",
    color: "white",
    marginBottom: 16, 
    textAlign: 'center',
  },

  frasePort: {
    fontSize: 20,
    color: "#cfe9ff",
    textAlign: 'center',
  },

  // Área que centraliza o conteúdo de Parabéns (abaixo do Header)
  areaParabensCentralizada: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80, 
  },

  // parabéns NÍVEL
  cardParabens: {
    width: "86%",
    backgroundColor: "#153158",
    padding: 24, 
    borderRadius: 16, 
    alignItems: "center",
  },

  tituloParabens: {
    fontSize: 26, 
    color: "white",
    fontWeight: "bold",
    marginBottom: 12,
  },

  textoParabens: {
    fontSize: 20, 
    color: "white",
    textAlign: "center",
  },

  // parabéns final
  cardParabensFinal: {
    width: "86%",
    backgroundColor: "#153158",
    padding: 26, 
    borderRadius: 16,
    alignItems: "center",
  },

  tituloParabensFinal: {
    fontSize: 26,
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 12,
  },

  textoParabensFinal: {
    fontSize: 20,
    color: "white",
    textAlign: "center",
  },
});